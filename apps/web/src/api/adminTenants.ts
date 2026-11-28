// apps/web/src/api/adminTenants.ts
// Control-plane tenant directory client.
// GET /admin/tenants is the single source of truth; normalizeAdminTenant maps
// whatever the service returns onto the view model. If a column renders blank,
// tighten the candidate keys in pick() - one place, no JSX surgery.
import { getApiClient } from './client';

export interface AdminTenant {
  id: string;
  name: string;
  plan: string;
  status: string;
  region: string | null;
  rooms: number | null;
  properties: number | null;
  createdAt: string | null;
  lastActiveAt: string | null;
}

const client = getApiClient();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(raw: any, keys: string[]): any {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeAdminTenant(raw: any): AdminTenant {
  return {
    id: String(raw.id ?? ''),
    name: String(pick(raw, ['name', 'propertyName', 'tenantName']) ?? 'Unnamed'),
    plan: String(pick(raw, ['plan', 'planCode', 'tier', 'saasPlan']) ?? 'unknown'),
    status: String(pick(raw, ['status', 'state', 'lifecycle']) ?? 'unknown'),
    region: pick(raw, ['region', 'regionCode', 'region_code', 'datacenter']) ?? null,
    rooms: pick(raw, ['rooms', 'roomCount', 'totalRooms']) ?? null,
    properties: pick(raw, ['properties', 'propertyCount']) ?? null,
    createdAt: pick(raw, ['createdAt', 'created_at']) ?? null,
    lastActiveAt: pick(raw, ['lastActiveAt', 'last_active_at', 'lastSeenAt']) ?? null,
  };
}

export async function listAdminTenants(): Promise<AdminTenant[]> {
  const res = (await client.get('/admin/tenants')) as
    { data?: unknown[]; tenants?: unknown[] } | unknown[];
  const rows = Array.isArray(res) ? res : (res?.data ?? res?.tenants ?? []);
  return (rows ?? []).map(normalizeAdminTenant);
}

/* Command Center strip: fleet MRR/movement/hotels/health + dunning position. */
export async function getFleetOpsDaily(): Promise<any> {
  return client.get('/admin/health/ops-daily');
}

/* Internal admin directory (control-plane identities, Phase 3b). */
export async function listInternalAdmins(): Promise<any> {
  return client.get('/admin/internal-admins');
}

export async function setInternalAdminActive(id: string, isActive: boolean): Promise<any> {
  return client.post('/admin/internal-admins/' + encodeURIComponent(id) + '/set-active', {
    isActive,
  });
}

/* Fleet webhook center (Phase 3, blueprint Pillar 5 Tab 2). */
export async function listFleetDeliveries(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  return client.get('/admin/webhooks/deliveries' + (qs ? '?' + qs : ''));
}

export async function getFleetDelivery(id: string): Promise<any> {
  return client.get('/admin/webhooks/deliveries/' + encodeURIComponent(id));
}

export async function replayFleetDelivery(id: string): Promise<any> {
  return client.post('/admin/webhooks/deliveries/' + encodeURIComponent(id) + '/replay', {});
}

export async function getWebhookStats(): Promise<any> {
  return client.get('/admin/webhooks/stats');
}
