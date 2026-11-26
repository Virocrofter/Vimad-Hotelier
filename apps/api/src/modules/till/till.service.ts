/* apps/api/src/modules/till/till.service.ts — F5 native till.
 * Open checks, line items, split-by-move, comps with reversal, tenders on
 * close (cash/card/voucher/room — room posts to the reservation folio),
 * and cash-up sessions with variance. Scalar-FK models, ChatThread pattern. */
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';

const r2 = (n: number) => Math.round(n * 100) / 100;

async function recompute(checkId: string) {
  const items = await prisma.tillCheckItem.findMany({ where: { checkId, reversed: false } });
  const charges = r2(items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0));
  const comps = r2(
    items.filter((i) => i.comped).reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)
  );
  await prisma.tillCheck.update({
    where: { id: checkId },
    data: { totalCharges: charges, totalComps: comps },
  });
}

const getOpenCheck = async (tenantId: string, checkId: string) => {
  const check = await prisma.tillCheck.findFirst({ where: { id: checkId, tenantId } });
  if (!check) throw new AppError(404, 'Check not found', 'NOT_FOUND');
  if (check.status !== 'open') {
    throw new AppError(409, `Check is ${check.status} — immutable`, 'CHECK_CLOSED');
  }
  return check;
};

export async function openCheck(
  tenantId: string,
  input: { propertyId: string; label: string; userId: string }
) {
  return prisma.tillCheck.create({
    data: {
      tenantId,
      propertyId: input.propertyId,
      label: input.label,
      status: 'open',
      openedById: input.userId,
    },
  });
}

export async function addItem(
  tenantId: string,
  checkId: string,
  input: { productId?: string; name?: string; unitPrice?: number; quantity?: number }
) {
  await getOpenCheck(tenantId, checkId);
  let name = input.name ?? '';
  let unitPrice = input.unitPrice ?? 0;
  if (input.productId) {
    const p = await prisma.upsellProduct.findFirst({
      where: { id: input.productId, tenantId, status: 'active' },
    });
    if (!p) throw new AppError(400, 'Item not on the catalog', 'VALIDATION_ERROR');
    name = p.name;
    if (!unitPrice) unitPrice = Number(p.price);
  }
  if (!name || !Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new AppError(400, 'A name and a non-negative price are required', 'VALIDATION_ERROR');
  }
  const item = await prisma.tillCheckItem.create({
    data: {
      tenantId,
      checkId,
      productId: input.productId ?? null,
      name,
      unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
      quantity: Math.max(1, Math.min(50, Math.floor(input.quantity ?? 1))),
    },
  });
  await recompute(checkId);
  return item;
}

/* Split: move a line to another OPEN check (same property). */
export async function moveItem(tenantId: string, itemId: string, toCheckId: string) {
  const item = await prisma.tillCheckItem.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw new AppError(404, 'Item not found', 'NOT_FOUND');
  const to = await getOpenCheck(tenantId, toCheckId);
  const from = await prisma.tillCheck.findFirst({ where: { id: item.checkId, tenantId } });
  if (!from || from.propertyId !== to.propertyId) {
    throw new AppError(409, 'Checks belong to different properties', 'CROSS_PROPERTY');
  }
  await prisma.tillCheckItem.update({ where: { id: itemId }, data: { checkId: toCheckId } });
  await recompute(item.checkId);
  await recompute(toCheckId);
  return prisma.tillCheckItem.findFirst({ where: { id: itemId } });
}

/* Comp with reversal: flag + reason; totals shift; reversible until close. */
export async function compItem(tenantId: string, itemId: string, reason: string) {
  const item = await prisma.tillCheckItem.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw new AppError(404, 'Item not found', 'NOT_FOUND');
  await getOpenCheck(tenantId, item.checkId);
  const updated = await prisma.tillCheckItem.update({
    where: { id: itemId },
    data: { comped: true, compReason: reason },
  });
  await recompute(item.checkId);
  return updated;
}

export async function reverseComp(tenantId: string, itemId: string) {
  const item = await prisma.tillCheckItem.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw new AppError(404, 'Item not found', 'NOT_FOUND');
  await getOpenCheck(tenantId, item.checkId);
  const updated = await prisma.tillCheckItem.update({
    where: { id: itemId },
    data: { comped: false, compReason: null },
  });
  await recompute(item.checkId);
  return updated;
}

async function recomputeFolio(folioId: string) {
  const agg = await prisma.folioItem.aggregate({
    where: { folioId },
    _sum: { amount: true },
  });
  await prisma.folio.update({
    where: { id: folioId },
    data: { totalCharges: agg._sum.amount ?? 0 },
  });
}

const toMinor = (major: number) => Math.round(major * 100);

/* Close: tenders must sum to the payable (charges − comps). Room tenders
 * post to the reservation's folio through the same ledger shape the upsell
 * chokepoint uses. */
export async function closeCheck(
  tenantId: string,
  checkId: string,
  payments: Array<{
    method: 'cash' | 'card' | 'voucher' | 'room';
    amountMinor: number;
    reservationId?: string;
  }>
) {
  const check = await getOpenCheck(tenantId, checkId);
  const fresh = await prisma.tillCheck.findFirst({ where: { id: checkId } });
  const payable = r2(Number(fresh!.totalCharges) - Number(fresh!.totalComps));
  const tendered = (payments ?? []).reduce((s, p) => s + p.amountMinor, 0);
  if (tendered !== toMinor(payable)) {
    throw new AppError(
      409,
      `Tenders must equal the payable R ${payable.toFixed(2)} (got R ${(tendered / 100).toFixed(2)})`,
      'TENDER_MISMATCH'
    );
  }
  if (payable <= 0)
    throw new AppError(409, 'Nothing to settle — comp or void items instead', 'NOTHING_DUE');

  const folioItemIds: string[] = [];
  for (const p of payments) {
    let folioItemId: string | null = null;
    if (p.method === 'room') {
      if (!p.reservationId)
        throw new AppError(400, 'room tender needs a reservationId', 'VALIDATION_ERROR');
      const reservation = await prisma.reservation.findFirst({
        where: { id: p.reservationId, tenantId },
        include: { folios: { take: 1 } },
      });
      if (!reservation) throw new AppError(404, 'Reservation not found', 'NOT_FOUND');
      const folio = reservation.folios[0];
      if (!folio) throw new AppError(404, 'Reservation has no folio', 'NOT_FOUND');
      const fi = await prisma.folioItem.create({
        data: {
          folioId: folio.id,
          type: 'fnb_till',
          description: `Bar/restaurant — check ${check.label}`,
          amount: new Prisma.Decimal((p.amountMinor / 100).toFixed(2)),
          consumedAt: new Date(),
        },
      });
      await recomputeFolio(folio.id);
      folioItemId = fi.id;
      folioItemIds.push(fi.id);
    }
    await prisma.tillPayment.create({
      data: { tenantId, checkId, method: p.method, amountMinor: p.amountMinor, folioItemId },
    });
  }
  const closed = await prisma.tillCheck.update({
    where: { id: checkId },
    data: { status: 'closed', closedAt: new Date() },
  });
  return { check: closed, folioItemIds };
}

export async function listChecks(tenantId: string, q: { propertyId?: string; status?: string }) {
  const checks = await prisma.tillCheck.findMany({
    where: {
      tenantId,
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
      ...(q.status ? { status: q.status } : {}),
    },
    orderBy: { openedAt: 'desc' },
    take: 200,
  });
  const out = [];
  for (const c of checks) {
    const items = await prisma.tillCheckItem.findMany({
      where: { checkId: c.id, reversed: false },
    });
    const payments = await prisma.tillPayment.findMany({ where: { checkId: c.id } });
    out.push({
      ...c,
      totalCharges: Number(c.totalCharges),
      totalComps: Number(c.totalComps),
      items,
      payments,
    });
  }
  return out;
}

/* Cash-up: expected = float + cash tenders since the session opened. */
export async function openSession(
  tenantId: string,
  input: { propertyId: string; openingFloatMinor: number; userId: string }
) {
  const existing = await prisma.tillSession.findFirst({
    where: { tenantId, propertyId: input.propertyId, status: 'open' },
  });
  if (existing)
    throw new AppError(409, 'A session is already open — close it first', 'SESSION_OPEN');
  return prisma.tillSession.create({
    data: {
      tenantId,
      propertyId: input.propertyId,
      openedById: input.userId,
      openingFloatMinor: input.openingFloatMinor,
      status: 'open',
    },
  });
}

export async function closeSession(tenantId: string, sessionId: string, countedCashMinor: number) {
  const session = await prisma.tillSession.findFirst({ where: { id: sessionId, tenantId } });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.status !== 'open')
    throw new AppError(409, 'Session already closed', 'SESSION_CLOSED');

  const checks = await prisma.tillCheck.findMany({
    where: {
      tenantId,
      propertyId: session.propertyId,
      status: 'closed',
      closedAt: { gte: session.openedAt },
    },
    select: { id: true },
  });
  const cashAgg = await prisma.tillPayment.aggregate({
    where: { tenantId, checkId: { in: checks.map((c) => c.id) }, method: 'cash' },
    _sum: { amountMinor: true },
  });
  const expected = session.openingFloatMinor + (cashAgg._sum.amountMinor ?? 0);
  const variance = countedCashMinor - expected;
  return prisma.tillSession.update({
    where: { id: sessionId },
    data: {
      status: 'closed',
      closedAt: new Date(),
      countedCashMinor,
      expectedCashMinor: expected,
      varianceMinor: variance,
    },
  });
}

export async function listSessions(tenantId: string, propertyId?: string) {
  const rows = await prisma.tillSession.findMany({
    where: { tenantId, ...(propertyId ? { propertyId } : {}) },
    orderBy: { openedAt: 'desc' },
    take: 50,
  });
  return rows;
}
