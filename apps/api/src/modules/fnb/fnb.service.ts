/* apps/api/src/modules/fnb/fnb.service.ts — F3 QR order-and-pay.
 * Prepaid standalone orders: menu rides the upsell catalog, payment is
 * Paystack-hosted, the staff queue carries prep status. The folio tie
 * (charge-to-room) rides the existing flow later — v1 is pay-now. */
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { env } from '../../common/env.js';
import { applySale, applyRestock } from '../stock/stock.service.js';
import { initializeTransaction, verifyTransaction, createRefund } from '../../common/paystack.js';

const toMinor = (major: number) => Math.round(major * 100);

export async function getMenu(code: string) {
  const property = await prisma.property.findFirst({ where: { code } });
  if (!property) throw new AppError(404, 'Property not found', 'NOT_FOUND');
  const items = await prisma.upsellProduct.findMany({
    where: { tenantId: property.tenantId, propertyId: property.id, status: 'active' },
    orderBy: { category: 'asc' },
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      imageKey: true,
      description: true,
    },
  });
  return {
    property: { id: property.id, name: property.name, code: property.code },
    items: items.map((i) => ({ ...i, price: Number(i.price) })),
  };
}

export async function createOrder(
  code: string,
  input: {
    items: Array<{ productId: string; quantity: number }>;
    email?: string;
    tableLabel?: string;
  }
) {
  const property = await prisma.property.findFirst({ where: { code } });
  if (!property) throw new AppError(404, 'Property not found', 'NOT_FOUND');
  if (!input.items?.length) throw new AppError(400, 'Order is empty', 'VALIDATION_ERROR');

  const ids = input.items.map((i) => i.productId);
  const products = await prisma.upsellProduct.findMany({
    where: {
      id: { in: ids },
      tenantId: property.tenantId,
      propertyId: property.id,
      status: 'active',
    },
  });
  if (products.length !== new Set(ids).size) {
    throw new AppError(400, 'One or more items are not on the menu', 'VALIDATION_ERROR');
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  let total = 0;
  const lines = input.items.map((i) => {
    const p = byId.get(i.productId)!;
    const qty = Math.max(1, Math.min(20, Math.floor(i.quantity)));
    const line = Number(p.price) * qty;
    total += line;
    return {
      productId: p.id,
      name: p.name,
      quantity: qty,
      unitPrice: Number(p.price),
      lineTotal: line,
    };
  });
  if (!(total > 0)) throw new AppError(400, 'Total must be positive', 'VALIDATION_ERROR');

  const reference = 'FNB-' + randomUUID().slice(0, 18).toUpperCase();
  const order = await prisma.fnBOrder.create({
    data: {
      tenantId: property.tenantId,
      propertyId: property.id,
      items: lines as unknown as Prisma.InputJsonValue,
      amount: new Prisma.Decimal(total.toFixed(2)),
      currency: env.PAYSTACK_CURRENCY,
      reference,
      email: input.email ?? null,
      tableLabel: input.tableLabel ?? null,
      status: 'pending',
    },
  });

  return {
    orderId: order.id,
    reference,
    amount: total,
    amountMinor: toMinor(total),
    currency: env.PAYSTACK_CURRENCY,
    items: lines,
  };
}

/* The single settle path: claim pending → paid (idempotent) and deduct
 * recipe-linked stock once. Called by verifyOrderPayment after gateway
 * confirmation; exported so suites exercise it without the network. */
export async function claimPaid(orderId: string, paystackId?: bigint) {
  const order = await prisma.fnBOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  if (order.status === 'paid') return order;
  const claim = await prisma.fnBOrder.updateMany({
    where: { id: order.id, status: 'pending' },
    data: { status: 'paid', ...(paystackId ? { paystackId } : {}), failureReason: null },
  });
  if (claim.count > 0) {
    const lines = order.items as Array<{ productId?: string; quantity: number }>;
    await applySale(order.tenantId, 'fnb_order', order.id, lines);
  }
  return prisma.fnBOrder.findUnique({ where: { id: order.id } });
}

/* Begin hosted payment (live leg — gated on platform Paystack keys like E2x). */
export async function beginPayment(orderId: string, email: string) {
  const order = await prisma.fnBOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  if (order.status !== 'pending') {
    throw new AppError(409, `Order is ${order.status}`, 'CONFLICT');
  }
  const checkout = await initializeTransaction({
    email,
    amountMinor: toMinor(Number(order.amount)),
    currency: order.currency,
    reference: order.reference,
    callbackUrl: `${env.WEB_URL.replace(/\/$/, '')}/fnb/confirmed`,
    metadata: { tenantId: order.tenantId, orderId: order.id, kind: 'fnb' },
  });
  return { reference: order.reference, authorizationUrl: checkout.authorization_url };
}

/* Verify + settle (called from the confirm page / webhook). Idempotent. */
export async function verifyOrderPayment(reference: string) {
  const order = await prisma.fnBOrder.findFirst({ where: { reference } });
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  if (order.status === 'paid') return order;

  const txData = await verifyTransaction(reference);
  if (txData.status === 'success' && txData.amount === toMinor(Number(order.amount))) {
    return claimPaid(order.id, BigInt(txData.id));
  }
  return prisma.fnBOrder.update({
    where: { id: order.id },
    data: {
      status: txData.status === 'failed' ? 'failed' : 'pending',
      failureReason: (txData.gateway_response ?? txData.message ?? 'verification failed').slice(
        0,
        500
      ),
    },
  });
}

const FLOW: Record<string, string[]> = {
  pending: ['cancelled'],
  paid: ['preparing', 'refunded'],
  preparing: ['served', 'cancelled'],
  served: ['preparing'], // F4 recall: a served order can bounce back to the pass
  cancelled: [],
  failed: [],
  refunded: [],
};

export async function transition(tenantId: string, id: string, next: string) {
  const order = await prisma.fnBOrder.findFirst({ where: { id, tenantId } });
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  const allowed = FLOW[order.status] ?? [];
  if (!allowed.includes(next)) {
    throw new AppError(409, `Cannot move a ${order.status} order to ${next}`, 'INVALID_TRANSITION');
  }
  return prisma.fnBOrder.update({ where: { id }, data: { status: next } });
}

export async function refund(tenantId: string, id: string, reason?: string) {
  const order = await prisma.fnBOrder.findFirst({ where: { id, tenantId } });
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  if (order.status !== 'paid' && order.status !== 'preparing') {
    throw new AppError(409, `Cannot refund a ${order.status} order`, 'CONFLICT');
  }
  if (!order.paystackId) {
    throw new AppError(
      409,
      'Order has no Paystack transaction id — cannot refund via gateway',
      'NOT_REFUNDABLE'
    );
  }
  const refundResult = await createRefund({
    transactionId: Number(order.paystackId),
    amountMinor: toMinor(Number(order.amount)),
  });
  const updated = await prisma.fnBOrder.update({
    where: { id },
    data: { status: 'refunded', failureReason: reason ?? null },
  });
  const refundLines = order.items as Array<{ productId?: string; quantity: number }>;
  await applyRestock(tenantId, 'fnb_order', order.id, refundLines);
  return { order: updated, refundId: refundResult.refundId };
}

export async function listOrders(tenantId: string, q: { status?: string; propertyId?: string }) {
  return prisma.fnBOrder.findMany({
    where: {
      tenantId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}
