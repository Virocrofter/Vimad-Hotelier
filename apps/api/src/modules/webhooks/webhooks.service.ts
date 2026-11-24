/* apps/api/src/modules/webhooks/webhooks.service.ts — D1+ developer webhooks.
 * HMAC-SHA256 signed delivery (per-endpoint secrets, 24h rotation grace),
 * 5-attempt exponential backoff with a sweep cadence, manual replay, full
 * observability. Emission is fire-and-forget: it never throws into callers. */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { logger } from '../../common/logger.js';
import { AppError } from '../../common/errors.js';

const BACKOFF_SECONDS = [60, 300, 1800, 7200, 43200];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length;
const GRACE_MS = 24 * 3600_000;
const RETRY_SWEEP_MS = 30_000;

export function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifySignature(
  secret: string,
  previousSecret: string | null,
  previousExpiresAt: Date | null,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const candidates = [secret];
  if (previousSecret && previousExpiresAt && previousExpiresAt.getTime() > Date.now()) {
    candidates.push(previousSecret);
  }
  return candidates.some((s) => {
    const expected = signPayload(s, timestamp, body);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

function toPublic(e: {
  id: string;
  url: string;
  events: string[];
  status: string;
  previousExpiresAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: e.id,
    url: e.url,
    events: e.events,
    status: e.status,
    previousExpiresAt: e.previousExpiresAt,
    createdAt: e.createdAt,
  };
}

export async function createEndpoint(
  tenantId: string,
  actorId: string,
  input: { url: string; events: string[] }
) {
  const url = String(input.url ?? '');
  if (
    !/^https:\/\//.test(url) &&
    !/^http:\/\/127\.0\.0\.1:/.test(url) &&
    !/^http:\/\/localhost:/.test(url)
  ) {
    throw new AppError(
      400,
      'Webhook URL must be https (or http localhost for dev)',
      'VALIDATION_ERROR'
    );
  }
  const events = (input.events ?? []).map(String).slice(0, 50);
  if (events.length === 0)
    throw new AppError(400, 'At least one event is required', 'VALIDATION_ERROR');
  const secret = randomBytes(32).toString('hex');
  const endpoint = await prisma.webhookEndpoint.create({
    data: { tenantId, url, events, secret, createdById: actorId, status: 'active' },
  });
  return { endpoint: toPublic(endpoint), secret };
}

export async function listEndpoints(tenantId: string) {
  const rows = await prisma.webhookEndpoint.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPublic);
}

export async function updateEndpoint(
  tenantId: string,
  id: string,
  patch: { url?: string; events?: string[]; status?: string }
) {
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, tenantId } });
  if (!existing) throw new AppError(404, 'Endpoint not found', 'NOT_FOUND');
  const endpoint = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(patch.url !== undefined ? { url: patch.url } : {}),
      ...(patch.events !== undefined ? { events: patch.events.map(String).slice(0, 50) } : {}),
      ...(patch.status !== undefined
        ? { status: patch.status === 'paused' ? 'paused' : 'active' }
        : {}),
    },
  });
  return toPublic(endpoint);
}

export async function deleteEndpoint(tenantId: string, id: string) {
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, tenantId } });
  if (!existing) throw new AppError(404, 'Endpoint not found', 'NOT_FOUND');
  await prisma.webhookEndpoint.delete({ where: { id } });
  return { deleted: true };
}

export async function rotateSecret(tenantId: string, id: string) {
  const existing = await prisma.webhookEndpoint.findFirst({ where: { id, tenantId } });
  if (!existing) throw new AppError(404, 'Endpoint not found', 'NOT_FOUND');
  const secret = randomBytes(32).toString('hex');
  await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      secret,
      previousSecret: existing.secret,
      previousExpiresAt: new Date(Date.now() + GRACE_MS),
    },
  });
  return { id, secret };
}

export function emitWebhookEvent(tenantId: string, event: string, payload: unknown): void {
  void (async () => {
    try {
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: { tenantId, status: 'active', events: { hasSome: [event, '*'] } },
      });
      for (const endpoint of endpoints) {
        const delivery = await prisma.webhookDispatch.create({
          data: {
            tenantId,
            endpointId: endpoint.id,
            event,
            payload: payload as Prisma.InputJsonValue,
            status: 'pending',
            attempts: 0,
            nextRetryAt: new Date(),
          },
        });
        void attemptDelivery(delivery.id).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err }, 'webhook emit failed');
    }
  })();
}

export async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDispatch.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || !delivery.endpoint || delivery.status === 'delivered') return;
  if (delivery.endpoint.status !== 'active') return;
  const endpoint = delivery.endpoint;
  const body = JSON.stringify({
    id: delivery.id,
    event: delivery.event,
    data: delivery.payload,
    sentAt: new Date().toISOString(),
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signPayload(endpoint.secret, timestamp, body);
  const started = Date.now();
  let statusCode: number | null = null;
  let ok = false;
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-vimad-signature': signature,
        'x-vimad-timestamp': timestamp,
        'x-vimad-event': delivery.event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    statusCode = res.status;
    ok = res.status >= 200 && res.status < 300;
  } catch {
    ok = false;
  }
  const attempts = delivery.attempts + 1;
  if (ok) {
    await prisma.webhookDispatch.update({
      where: { id: deliveryId },
      data: {
        status: 'delivered',
        attempts,
        statusCode,
        durationMs: Date.now() - started,
        nextRetryAt: null,
        lastError: null,
        deliveredAt: new Date(),
      },
    });
    return;
  }
  const nextRetryAt =
    attempts < MAX_ATTEMPTS ? new Date(Date.now() + BACKOFF_SECONDS[attempts] * 1000) : null;
  await prisma.webhookDispatch.update({
    where: { id: deliveryId },
    data: {
      status: nextRetryAt ? 'pending' : 'failed',
      attempts,
      statusCode,
      durationMs: Date.now() - started,
      nextRetryAt,
      lastError: statusCode ? `HTTP ${statusCode}` : 'network error',
    },
  });
}

export async function sweepWebhookRetries(): Promise<number> {
  const due = await prisma.webhookDispatch.findMany({
    where: { status: 'pending', nextRetryAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    take: 50,
  });
  for (const d of due) {
    void attemptDelivery(d.id).catch(() => {});
  }
  return due.length;
}

let sweepTimer: NodeJS.Timeout | null = null;
export function startWebhooksCadence(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    void sweepWebhookRetries().catch(() => {});
  }, RETRY_SWEEP_MS);
  sweepTimer.unref?.();
}

export async function listDeliveries(
  tenantId: string,
  q: { endpointId?: string; status?: string; page?: number; pageSize?: number }
) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  const where = {
    tenantId,
    ...(q.endpointId ? { endpointId: q.endpointId } : {}),
    ...(q.status ? { status: q.status } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.webhookDispatch.count({ where }),
    prisma.webhookDispatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items, total, page, pageSize };
}

export async function replayDelivery(tenantId: string, deliveryId: string) {
  const delivery = await prisma.webhookDispatch.findFirst({ where: { id: deliveryId, tenantId } });
  if (!delivery) throw new AppError(404, 'Delivery not found', 'NOT_FOUND');
  await prisma.webhookDispatch.update({
    where: { id: deliveryId },
    data: { status: 'pending', attempts: 0, nextRetryAt: new Date(), lastError: null },
  });
  void attemptDelivery(deliveryId).catch(() => {});
  return { replayed: true };
}

export async function sendTestEvent(tenantId: string, endpointId: string) {
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, tenantId } });
  if (!endpoint) throw new AppError(404, 'Endpoint not found', 'NOT_FOUND');
  const delivery = await prisma.webhookDispatch.create({
    data: {
      tenantId,
      endpointId,
      event: 'test',
      payload: { test: true, at: new Date().toISOString() } as Prisma.InputJsonValue,
      status: 'pending',
      attempts: 0,
      nextRetryAt: new Date(),
    },
  });
  void attemptDelivery(delivery.id).catch(() => {});
  return { deliveryId: delivery.id };
}
