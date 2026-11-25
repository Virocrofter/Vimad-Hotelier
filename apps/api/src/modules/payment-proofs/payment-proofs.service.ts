/* apps/api/src/modules/payment-proofs/payment-proofs.service.ts — P44 EFT
 * proof-of-payment: guests EFT and WhatsApp/e-mail proof; staff verify and the
 * payment posts to the folio through the folios chokepoint in the same action. */
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { postPayment } from '../folios/folios.service.js';

const toPublic = (p: {
  id: string;
  reservationId: string;
  amount: unknown;
  currency: string;
  reference: string | null;
  note: string | null;
  status: string;
  verifiedAt: Date | null;
  verifiedFolioId: string | null;
  rejectionReason: string | null;
  createdAt: Date;
}) => ({
  id: p.id,
  reservationId: p.reservationId,
  amount: Number(p.amount),
  currency: p.currency,
  reference: p.reference,
  note: p.note,
  status: p.status,
  verifiedAt: p.verifiedAt,
  verifiedFolioId: p.verifiedFolioId,
  rejectionReason: p.rejectionReason,
  createdAt: p.createdAt,
});

export async function create(
  tenantId: string,
  actorId: string,
  input: {
    reservationId: string;
    amount: number;
    reference?: string;
    note?: string;
    fileId?: string;
  }
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: input.reservationId, tenantId },
  });
  if (!reservation) throw new AppError(404, 'Reservation not found', 'NOT_FOUND');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, 'Amount must be positive', 'VALIDATION_ERROR');
  }
  const proof = await prisma.paymentProof.create({
    data: {
      tenantId,
      reservationId: reservation.id,
      amount,
      reference: input.reference ?? null,
      note: input.note ?? null,
      fileId: input.fileId ?? null,
      createdById: actorId,
      status: 'pending',
    },
  });
  return toPublic(proof);
}

export async function list(tenantId: string, q: { reservationId?: string; status?: string }) {
  const rows = await prisma.paymentProof.findMany({
    where: {
      tenantId,
      ...(q.reservationId ? { reservationId: q.reservationId } : {}),
      ...(q.status ? { status: q.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map(toPublic);
}

/* Verify: mark the proof verified AND post the payment to the folio through
 * the existing chokepoint — one action, one audit trail. */
export async function verify(tenantId: string, actorId: string, id: string, folioId: string) {
  const proof = await prisma.paymentProof.findFirst({ where: { id, tenantId } });
  if (!proof) throw new AppError(404, 'Payment proof not found', 'NOT_FOUND');
  if (proof.status === 'verified') {
    throw new AppError(409, 'Proof already verified', 'ALREADY_VERIFIED');
  }
  if (proof.status === 'rejected') {
    throw new AppError(409, 'Proof was rejected — create a new one', 'REJECTED');
  }
  await postPayment(tenantId, folioId, {
    type: 'payment',
    description: `EFT payment${proof.reference ? ` — ref ${proof.reference}` : ''} (POP verified)`,
    amount: Number(proof.amount),
  } as never);
  const updated = await prisma.paymentProof.update({
    where: { id },
    data: {
      status: 'verified',
      verifiedById: actorId,
      verifiedAt: new Date(),
      verifiedFolioId: folioId,
    },
  });
  return toPublic(updated);
}

export async function reject(tenantId: string, actorId: string, id: string, reason: string) {
  const proof = await prisma.paymentProof.findFirst({ where: { id, tenantId } });
  if (!proof) throw new AppError(404, 'Payment proof not found', 'NOT_FOUND');
  if (proof.status !== 'pending') {
    throw new AppError(409, `Cannot reject a ${proof.status} proof`, 'CONFLICT');
  }
  const updated = await prisma.paymentProof.update({
    where: { id },
    data: { status: 'rejected', verifiedById: actorId, rejectionReason: reason },
  });
  return toPublic(updated);
}
