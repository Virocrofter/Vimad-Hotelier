/* apps/api/src/modules/integrations/integrations.admin.service.ts — D2
 * marketplace backend: tenant-scoped integration installations over a lean
 * API catalog. Sync v1 records observability (lastSyncAt/Status); real
 * provider pings ride future per-provider adapters. */

export const INTEGRATION_CATALOG = [
  { key: 'slack', name: 'Slack', category: 'Communication', availability: 'connected' },
  {
    key: 'whatsapp-business',
    name: 'WhatsApp Business',
    category: 'Communication',
    availability: 'connected',
  },
  { key: 'xero', name: 'Xero', category: 'Accounting & Finance', availability: 'connected' },
  {
    key: 'sage-pastel',
    name: 'Sage Pastel',
    category: 'Accounting & Finance',
    availability: 'planned',
  },
  { key: 'paystack', name: 'Paystack', category: 'Payments', availability: 'connected' },
  { key: 'stripe', name: 'Stripe', category: 'Payments', availability: 'planned' },
  { key: 'google-ads', name: 'Google Ads', category: 'Marketing & CRM', availability: 'planned' },
  { key: 'mailchimp', name: 'Mailchimp', category: 'Marketing & CRM', availability: 'connected' },
  {
    key: 'channex',
    name: 'Channex',
    category: 'Distribution & Channels',
    availability: 'connected',
  },
  {
    key: 'booking-com',
    name: 'Booking.com',
    category: 'Distribution & Channels',
    availability: 'planned',
  },
  { key: 'expedia', name: 'Expedia', category: 'Distribution & Channels', availability: 'planned' },
  { key: 'netsuite', name: 'NetSuite', category: 'Data & Analytics', availability: 'planned' },
] as const;

import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';

const toPublic = (row: {
  id: string;
  catalogKey: string;
  displayName: string | null;
  config: unknown;
  status: string;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: Date;
}) => ({
  id: row.id,
  provider: row.catalogKey,
  displayName: row.displayName,
  config: row.config ?? {},
  status: row.status,
  lastSyncAt: row.lastSyncAt,
  lastSyncStatus: row.lastSyncStatus,
  lastSyncError: row.lastSyncError,
  createdAt: row.createdAt,
});

export async function listProviders(tenantId: string) {
  const installs = await prisma.integrationInstallation.findMany({ where: { tenantId } });
  const byKey = new Map(installs.map((i) => [i.catalogKey, i]));
  return INTEGRATION_CATALOG.map((c) => ({
    ...c,
    connected: byKey.get(c.key)?.status === 'connected' ? toPublic(byKey.get(c.key)!) : null,
  }));
}

export async function listConnected(tenantId: string) {
  const rows = await prisma.integrationInstallation.findMany({
    where: { tenantId, status: 'connected' },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toPublic);
}

export async function stats(tenantId: string) {
  const [connected, total] = await Promise.all([
    prisma.integrationInstallation.count({ where: { tenantId, status: 'connected' } }),
    prisma.integrationInstallation.count({ where: { tenantId } }),
  ]);
  return { connected, total, available: INTEGRATION_CATALOG.length };
}

export async function connect(
  tenantId: string,
  actorId: string,
  input: {
    provider: string;
    credentials?: Record<string, unknown>;
    config?: Record<string, unknown>;
  }
) {
  const catalogEntry = INTEGRATION_CATALOG.find((c) => c.key === input.provider);
  if (!catalogEntry) throw new AppError(404, 'Unknown integration provider', 'NOT_FOUND');
  const existing = await prisma.integrationInstallation.findFirst({
    where: { tenantId, catalogKey: input.provider },
  });
  const data = {
    credentials: (input.credentials ?? undefined) as object | undefined,
    config: (input.config ?? undefined) as object | undefined,
    status: 'connected',
    lastSyncAt: new Date(),
    lastSyncStatus: 'ok',
    lastSyncError: null,
  };
  const row = existing
    ? await prisma.integrationInstallation.update({ where: { id: existing.id }, data })
    : await prisma.integrationInstallation.create({
        data: {
          tenantId,
          catalogKey: input.provider,
          displayName: catalogEntry.name,
          connectedById: actorId,
          ...data,
        },
      });
  return toPublic(row);
}

export async function disconnect(tenantId: string, id: string) {
  const row = await prisma.integrationInstallation.findFirst({ where: { id, tenantId } });
  if (!row) throw new AppError(404, 'Integration not found', 'NOT_FOUND');
  const updated = await prisma.integrationInstallation.update({
    where: { id },
    data: { status: 'disconnected', lastSyncError: null },
  });
  return toPublic(updated);
}

export async function sync(tenantId: string, id: string) {
  const row = await prisma.integrationInstallation.findFirst({ where: { id, tenantId } });
  if (!row) throw new AppError(404, 'Integration not found', 'NOT_FOUND');
  // v1: record the sync attempt observably; per-provider adapters come later.
  const updated = await prisma.integrationInstallation.update({
    where: { id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: row.status === 'connected' ? 'ok' : 'unavailable',
      lastSyncError: null,
    },
  });
  return toPublic(updated);
}

export async function test(tenantId: string, id: string) {
  const row = await prisma.integrationInstallation.findFirst({ where: { id, tenantId } });
  if (!row) throw new AppError(404, 'Integration not found', 'NOT_FOUND');
  const hasAnyConfig = Boolean(row.credentials) || Boolean(row.config);
  const updated = await prisma.integrationInstallation.update({
    where: { id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: hasAnyConfig ? 'ok' : 'unverified',
      lastSyncError: hasAnyConfig ? null : 'No credentials or config on file',
    },
  });
  return toPublic(updated);
}

export async function updateConfig(
  tenantId: string,
  id: string,
  patch: { config?: Record<string, unknown> }
) {
  const row = await prisma.integrationInstallation.findFirst({ where: { id, tenantId } });
  if (!row) throw new AppError(404, 'Integration not found', 'NOT_FOUND');
  const updated = await prisma.integrationInstallation.update({
    where: { id },
    data: { config: (patch.config ?? undefined) as object | undefined },
  });
  return toPublic(updated);
}
