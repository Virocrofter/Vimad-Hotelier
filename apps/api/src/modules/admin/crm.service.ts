/* apps/api/src/modules/admin/crm.service.ts
 * CRM / Durban funnel (Phase 3, 2026-11-28 - blueprint Pillar 6). Raw SQL
 * throughout: the funnel columns (zone/status/walkInNotes/demoSessionId)
 * were added by migration and are deliberately NOT in schema.prisma, so the
 * Prisma client doesn't know them - same house style as the health service.
 * Convert runs the lead through the production demo-access engine:
 * request -> approve (living seeded hotel) -> invite (24h magic link). */
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { requestDemo, approveSession, inviteSession } from './admin.demo-access.service.js';

export const LEAD_STATUSES = ['new', 'contacted', 'demo_booked', 'pilot', 'won', 'lost'] as const;

let leadsTable: string | null = null;
async function table(): Promise<string> {
  if (leadsTable) return leadsTable;
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT table_name AS t FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('Lead', 'leads') LIMIT 1`
  )) as any[];
  if (!rows[0]?.t) throw new Error('leads table not found');
  const name: string = rows[0].t;
  leadsTable = name;
  return name;
}

const COLS = `id, name, email, phone, "propertyName", "roomCount", "currentPms", message,
  source, zone, status, "walkInNotes", "demoSessionId",
  "lastContactedAt"::text AS "lastContactedAt", "convertedAt"::text AS "convertedAt",
  "createdAt"::text AS "createdAt"`;

export async function listLeads(q: {
  status?: string;
  zone?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const t = await table();
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 50));
  const cond: string[] = [];
  const params: any[] = [];
  if (q.status) {
    params.push(q.status);
    cond.push(`status = $${params.length}`);
  }
  if (q.zone) {
    params.push(q.zone);
    cond.push(`zone = $${params.length}`);
  }
  if (q.search) {
    params.push(`%${q.search}%`);
    const p = `$${params.length}`;
    cond.push(`(name ILIKE ${p} OR email ILIKE ${p} OR "propertyName" ILIKE ${p})`);
  }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const total =
    (
      (await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM "${t}" ${where}`,
        ...params
      )) as any[]
    )[0]?.n ?? 0;
  params.push(pageSize, (page - 1) * pageSize);
  const items = await prisma.$queryRawUnsafe(
    `SELECT ${COLS} FROM "${t}" ${where}
     ORDER BY "createdAt" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    ...params
  );
  return { items, total, page, pageSize, statuses: LEAD_STATUSES };
}

const PATCHABLE: Record<string, string> = {
  status: 'status',
  zone: 'zone',
  walkInNotes: 'walkInNotes',
  name: 'name',
  phone: 'phone',
  propertyName: 'propertyName',
  currentPms: 'currentPms',
};

export async function updateLead(
  id: string,
  patch: Partial<{
    status: string;
    zone: string;
    walkInNotes: string;
    name: string;
    phone: string;
    propertyName: string;
    roomCount: number;
    currentPms: string;
  }>
) {
  const t = await table();
  if (patch.status && !(LEAD_STATUSES as readonly string[]).includes(patch.status)) {
    throw new AppError(400, 'Unknown status: ' + patch.status, 'VALIDATION_ERROR');
  }
  const sets: string[] = [];
  const params: any[] = [];
  for (const [k, col] of Object.entries(PATCHABLE)) {
    const v = (patch as any)[k];
    if (v !== undefined) {
      params.push(v === '' ? null : v);
      sets.push(`"${col}" = $${params.length}`);
    }
  }
  if (patch.roomCount !== undefined) {
    params.push(patch.roomCount);
    sets.push(`"roomCount" = $${params.length}`);
  }
  if (patch.status && patch.status !== 'new') sets.push('"lastContactedAt" = now()');
  if (!sets.length) {
    return (
      (await prisma.$queryRawUnsafe(`SELECT ${COLS} FROM "${t}" WHERE id = $1`, id)) as any[]
    )[0];
  }
  params.push(id);
  return (
    (await prisma.$queryRawUnsafe(
      `UPDATE "${t}" SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${COLS}`,
      ...params
    )) as any[]
  )[0];
}

/* 1-click Convert Prospect -> Pilot Tenant via the demo-access engine. */
export async function convertLead(id: string, adminEmail: string) {
  const t = await table();
  const lead = (
    (await prisma.$queryRawUnsafe(`SELECT ${COLS} FROM "${t}" WHERE id = $1`, id)) as any[]
  )[0];
  if (!lead) throw new AppError(404, 'Lead not found', 'NOT_FOUND');
  if (lead.demoSessionId) throw new AppError(409, 'Lead already converted', 'CONFLICT');

  const { session } = await requestDemo({
    email: lead.email,
    name: lead.name,
    hotelName: lead.propertyName ?? undefined,
    phone: lead.phone ?? undefined,
    roomCount: lead.roomCount ?? null,
    currentPms: lead.currentPms ?? undefined,
    notes:
      [lead.walkInNotes && 'Walk-in: ' + lead.walkInNotes, lead.message]
        .filter(Boolean)
        .join(' - ') || undefined,
  });

  const approved = await approveSession(session.id, {
    days: 14,
    grantedBy: adminEmail,
    note: 'CRM convert (lead ' + id + ')',
  });
  const invite = await inviteSession(session.id, adminEmail);

  await prisma.$executeRawUnsafe(
    `UPDATE "${t}" SET status = 'pilot', "demoSessionId" = $2, "convertedAt" = now() WHERE id = $1`,
    id,
    session.id
  );

  return {
    tenantSlug: approved.tenantSlug,
    demoCredentials: approved.credentials,
    inviteUrl: invite.url,
    inviteExpiresAt: invite.expiresAt,
  };
}
