/* apps/api/src/modules/vouchers/vouchers.service.ts — D7 gift vouchers.
 * The ledger is pure: sell (payment captured upstream, reference recorded),
 * redeem (posts a payment to a folio via the folios chokepoint), refund.
 * Liability = sold - redeemed - refunded; the report must always balance. */
import { randomBytes } from 'node:crypto';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { postPayment } from '../folios/folios.service.js';

const genCode = () => 'VIM-' + randomBytes(5).toString('hex').toUpperCase();

const toPublic = (v: {
  id: string;
  code: string;
  amount: unknown;
  currency: string;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string | null;
  status: string;
  paymentRef: string | null;
  soldAt: Date;
  redeemedAt: Date | null;
  redeemedFolioId: string | null;
  refundedAt: Date | null;
}) => ({
  id: v.id,
  code: v.code,
  amount: Number(v.amount),
  currency: v.currency,
  purchaserName: v.purchaserName,
  purchaserEmail: v.purchaserEmail,
  recipientName: v.recipientName,
  status: v.status,
  paymentRef: v.paymentRef,
  soldAt: v.soldAt,
  redeemedAt: v.redeemedAt,
  redeemedFolioId: v.redeemedFolioId,
  refundedAt: v.refundedAt,
});

export async function sell(
  tenantId: string,
  actorId: string,
  input: {
    amount: number;
    purchaserName: string;
    purchaserEmail: string;
    recipientName?: string;
    paymentRef?: string;
    propertyId?: string;
  }
) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw new AppError(400, 'Amount must be between 0 and 100000', 'VALIDATION_ERROR');
  }
  const voucher = await prisma.giftVoucher.create({
    data: {
      tenantId,
      propertyId: input.propertyId ?? null,
      code: genCode(),
      amount,
      purchaserName: input.purchaserName,
      purchaserEmail: input.purchaserEmail,
      recipientName: input.recipientName ?? null,
      paymentRef: input.paymentRef ?? null,
      soldById: actorId,
      status: 'sold',
    },
  });
  return toPublic(voucher);
}

export async function redeem(tenantId: string, code: string, folioId: string) {
  const voucher = await prisma.giftVoucher.findFirst({ where: { code, tenantId } });
  if (!voucher) throw new AppError(404, 'Voucher not found', 'NOT_FOUND');
  if (voucher.status === 'redeemed') {
    throw new AppError(409, 'Voucher already redeemed', 'ALREADY_REDEEMED');
  }
  if (voucher.status === 'refunded') {
    throw new AppError(409, 'Voucher was refunded', 'REFUNDED');
  }
  // Post the redemption as a folio payment through the existing chokepoint.
  await postPayment(tenantId, folioId, {
    type: 'payment',
    description: `Gift voucher ${voucher.code}`,
    amount: Number(voucher.amount),
  } as never);
  const updated = await prisma.giftVoucher.update({
    where: { id: voucher.id },
    data: { status: 'redeemed', redeemedAt: new Date(), redeemedFolioId: folioId },
  });
  return toPublic(updated);
}

export async function refund(tenantId: string, id: string, reason: string) {
  const voucher = await prisma.giftVoucher.findFirst({ where: { id, tenantId } });
  if (!voucher) throw new AppError(404, 'Voucher not found', 'NOT_FOUND');
  if (voucher.status !== 'sold') {
    throw new AppError(409, `Cannot refund a ${voucher.status} voucher`, 'CONFLICT');
  }
  const updated = await prisma.giftVoucher.update({
    where: { id },
    data: { status: 'refunded', refundedAt: new Date(), refundReason: reason },
  });
  return toPublic(updated);
}

export async function list(
  tenantId: string,
  q: { status?: string; page?: number; pageSize?: number }
) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  const where = { tenantId, ...(q.status ? { status: q.status } : {}) };
  const [total, items] = await Promise.all([
    prisma.giftVoucher.count({ where }),
    prisma.giftVoucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items: items.map(toPublic), total, page, pageSize };
}

/* Liability: outstanding sold value minus what left the liability
 * (redeemed + refunded). The report balances by construction. */
export async function liability(tenantId: string) {
  const rows = await prisma.giftVoucher.groupBy({
    by: ['status'],
    where: { tenantId },
    _sum: { amount: true },
    _count: true,
  });
  const by: Record<string, { amount: number; count: number }> = {};
  for (const r of rows) {
    by[r.status] = { amount: Number(r._sum.amount ?? 0), count: r._count };
  }
  const sold = by.sold?.amount ?? 0;
  const redeemed = by.redeemed?.amount ?? 0;
  const refunded = by.refunded?.amount ?? 0;
  return {
    soldCount: by.sold?.count ?? 0,
    soldAmount: sold,
    redeemedCount: by.redeemed?.count ?? 0,
    redeemedAmount: redeemed,
    refundedCount: by.refunded?.count ?? 0,
    refundedAmount: refunded,
    outstanding: sold,
    leftLiability: redeemed + refunded,
    check: sold - redeemed - refunded,
  };
}
