/* apps/api/src/modules/preauth/preauth.service.ts — preauthorization holds.
 * Paystack's honest preauth pattern: the hold charge authorizes the card
 * (reusable authorization_code), capture charges that authorization later
 * (possibly a different amount), void refunds the authorization charge.
 * Claim-style settles are idempotent — the suite drives them without the
 * network; live gateway legs are key-gated like the rest of payments. */
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { newReference, chargeAuthorization, createRefund } from '../../common/paystack.js';

const toMajor = (minor: number) => Math.round(minor) / 100;

export async function createHold(
  tenantId: string,
  input: {
    propertyId: string;
    reservationId: string;
    email: string;
    amountMinor: number;
    currency?: string;
  }
) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new AppError(400, 'amountMinor must be a positive integer', 'VALIDATION_ERROR');
  }
  const reservation = await prisma.reservation.findFirst({
    where: { id: input.reservationId, tenantId },
    select: { id: true, propertyId: true },
  });
  if (!reservation) throw new AppError(404, 'Reservation not found', 'NOT_FOUND');

  return prisma.preauth.create({
    data: {
      tenantId,
      propertyId: input.propertyId,
      reservationId: reservation.id,
      email: input.email,
      amountMinor: input.amountMinor,
      currency: input.currency ?? 'ZAR',
      status: 'open',
      reference: newReference('PAH'),
    },
  });
}

/* Called from the hold-charge verification (live wiring) once the gateway
 * confirms the authorization. */
export async function attachAuthorization(
  preauthId: string,
  authorizationCode: string,
  authorizationTransactionId: number
) {
  return prisma.preauth.update({
    where: { id: preauthId },
    data: { authorizationCode, authorizationTransactionId: BigInt(authorizationTransactionId) },
  });
}

async function getHold(tenantId: string, id: string) {
  const hold = await prisma.preauth.findFirst({ where: { id, tenantId } });
  if (!hold) throw new AppError(404, 'Preauth not found', 'NOT_FOUND');
  return hold;
}

async function recomputeFolio(folioId: string) {
  const agg = await prisma.folioItem.aggregate({ where: { folioId }, _sum: { amount: true } });
  await prisma.folio.update({
    where: { id: folioId },
    data: { totalCharges: agg._sum.amount ?? 0 },
  });
}

/* The single capture settle: claim once, post the folio capture, recompute.
 * Idempotent — repeated calls return the captured hold unchanged. */
export async function claimCaptured(preauthId: string, captureTransactionId?: number) {
  const hold = await prisma.preauth.findUnique({ where: { id: preauthId } });
  if (!hold) throw new AppError(404, 'Preauth not found', 'NOT_FOUND');
  if (hold.status === 'captured') return hold;

  const claim = await prisma.preauth.updateMany({
    where: { id: hold.id, status: 'open' },
    data: {
      status: 'captured',
      capturedAt: new Date(),
      ...(captureTransactionId ? { captureReference: String(captureTransactionId) } : {}),
    } as never,
  });
  if (claim.count > 0) {
    const folio = await prisma.folio.findFirst({ where: { reservationId: hold.reservationId } });
    if (!folio) throw new AppError(404, 'Reservation has no folio', 'NOT_FOUND');
    await prisma.folioItem.create({
      data: {
        folioId: folio.id,
        type: 'preauth_capture',
        description: `Card capture (hold ${hold.reference})`,
        amount: new Prisma.Decimal(toMajor(hold.amountMinor).toFixed(2)),
        consumedAt: new Date(),
      },
    });
    await recomputeFolio(folio.id);
  }
  return prisma.preauth.findUnique({ where: { id: hold.id } });
}

/* Full capture: gateway charge of the stored authorization, then claim.
 * Gateway leg is live-key-gated; the suite stubs the module boundary. */
export async function capture(tenantId: string, id: string) {
  const hold = await getHold(tenantId, id);
  if (hold.status !== 'open') throw new AppError(409, `Hold is ${hold.status}`, 'CONFLICT');
  if (!hold.authorizationCode) {
    throw new AppError(409, 'Hold has no card authorization yet', 'HOLD_NOT_AUTHORIZED');
  }
  const captureReference = newReference('PAC');
  const tx = await chargeAuthorization({
    authorizationCode: hold.authorizationCode,
    email: hold.email,
    amountMinor: hold.amountMinor,
    currency: hold.currency,
    reference: captureReference,
  });
  if (tx.status !== 'success') {
    throw new AppError(502, tx.gateway_response ?? 'Capture failed', 'CAPTURE_FAILED');
  }
  return claimCaptured(hold.id, tx.id);
}

/* Void: refund the authorization charge, then claim voided. */
export async function claimVoided(preauthId: string) {
  const hold = await prisma.preauth.findUnique({ where: { id: preauthId } });
  if (!hold) throw new AppError(404, 'Preauth not found', 'NOT_FOUND');
  if (hold.status !== 'open') return hold;
  await prisma.preauth.updateMany({
    where: { id: hold.id, status: 'open' },
    data: { status: 'voided', voidedAt: new Date() },
  });
  return prisma.preauth.findUnique({ where: { id: hold.id } });
}

export async function voidHold(tenantId: string, id: string) {
  const hold = await getHold(tenantId, id);
  if (hold.status !== 'open') throw new AppError(409, `Hold is ${hold.status}`, 'CONFLICT');
  if (!hold.authorizationTransactionId) {
    throw new AppError(409, 'Nothing authorized to refund', 'NOT_VOIDABLE');
  }
  await createRefund({ transactionId: Number(hold.authorizationTransactionId) });
  return claimVoided(hold.id);
}

export async function listHolds(tenantId: string, reservationId?: string) {
  return prisma.preauth.findMany({
    where: { tenantId, ...(reservationId ? { reservationId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
