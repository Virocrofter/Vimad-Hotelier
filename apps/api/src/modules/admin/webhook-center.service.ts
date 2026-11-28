/* apps/api/src/modules/admin/webhook-center.service.ts
 * Fleet-wide webhook delivery center (Phase 3, 2026-11-28 — blueprint
 * Pillar 5 Tab 2). The delivery engine lives in modules/webhooks
 * (webhookDispatch model, HMAC-signed, backoff retries, replay). This is
 * the FOUNDER-side cross-tenant view: every hotel's deliveries, failed
 * first, one-click replay. */
import { prisma } from '../../common/prisma.js';
import { attemptDelivery } from '../webhooks/webhooks.service.js';
import { AppError } from '../../common/errors.js';

export async function listFleetDeliveries(q: {
  status?: string;
  tenantId?: string;
  event?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.tenantId ? { tenantId: q.tenantId } : {}),
    ...(q.event ? { event: q.event } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.webhookDispatch.count({ where }),
    prisma.webhookDispatch.findMany({
      where,
      include: { endpoint: { select: { url: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const tenantIds = [...new Set(items.map((i) => i.tenantId))];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true },
  });
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
  return {
    items: items.map((i) => ({
      id: i.id,
      tenantId: i.tenantId,
      tenantName: tenantName.get(i.tenantId) ?? i.tenantId,
      event: i.event,
      endpointUrl: (i as any).endpoint?.url ?? null,
      status: i.status,
      attempts: i.attempts,
      statusCode: (i as any).statusCode ?? null,
      durationMs: (i as any).durationMs ?? null,
      lastError: (i as any).lastError ?? null,
      deliveredAt: (i as any).deliveredAt ?? null,
      createdAt: i.createdAt,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getFleetDelivery(id: string) {
  const d = await prisma.webhookDispatch.findUnique({
    where: { id },
    include: { endpoint: { select: { url: true, status: true, events: true } } },
  });
  if (!d) throw new AppError(404, 'Delivery not found', 'NOT_FOUND');
  const tenant = await prisma.tenant.findUnique({
    where: { id: d.tenantId },
    select: { name: true },
  });
  return { ...d, tenantName: tenant?.name ?? d.tenantId };
}

export async function replayFleetDelivery(id: string) {
  const d = await prisma.webhookDispatch.findUnique({ where: { id } });
  if (!d) throw new AppError(404, 'Delivery not found', 'NOT_FOUND');
  await prisma.webhookDispatch.update({
    where: { id },
    data: { status: 'pending', attempts: 0, nextRetryAt: new Date(), lastError: null },
  });
  void attemptDelivery(id).catch(() => {});
  return { replayed: true };
}

export async function getWebhookStats() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const grouped = await prisma.webhookDispatch.groupBy({
    by: ['status'],
    where: { createdAt: { gte: since } },
    _count: { status: true },
  });
  const byStatus: Record<string, number> = {};
  for (const g of grouped) byStatus[g.status] = g._count.status;
  const pendingRetry = await prisma.webhookDispatch.count({
    where: { status: 'pending', nextRetryAt: { lte: new Date() } },
  });
  return { windowHours: 24, byStatus, pendingRetry };
}
