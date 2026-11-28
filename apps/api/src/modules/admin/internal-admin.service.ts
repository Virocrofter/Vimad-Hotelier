/* apps/api/src/modules/admin/internal-admin.service.ts
 * InternalAdminUser + ImpersonationSession (Phase 3a, 2026-11-28).
 * Control-plane identities separate from hotel-staff accounts.
 * Bootstrap rule: while the table is EMPTY, the first env-allowed email
 * self-provisions as FOUNDER — the founder can never lock himself out.
 * Once the table holds any row, the table wins (env list stops granting).
 * TOTP enrolment + full audit-log integration land in Phase 3b. */
import { prisma } from '../../common/prisma.js';
import { logger } from '../../common/logger.js';

export interface InternalAdmin {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  totpEnabled: boolean;
  allowedIps: unknown;
  isActive: boolean;
  provisionedFromEnv: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function envAllows(email: string): boolean {
  return platformAdminEmails().includes(email.toLowerCase());
}

function mapRow(r: any): InternalAdmin {
  return {
    ...r,
    totpEnabled: Boolean(r.totpEnabled),
    isActive: Boolean(r.isActive),
    provisionedFromEnv: Boolean(r.provisionedFromEnv),
  };
}

const SELECT_COLS = `id, email, "fullName", role, "totpEnabled", "allowedIps",
  "isActive", "provisionedFromEnv", "lastLoginAt"::text AS "lastLoginAt",
  "createdAt"::text AS "createdAt"`;

export async function getInternalAdminByEmail(email: string): Promise<InternalAdmin | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT ${SELECT_COLS} FROM "internal_admin_users" WHERE lower(email) = lower($1) LIMIT 1`,
    email
  )) as any[];
  return rows[0] ? mapRow(rows[0]) : null;
}

async function countInternalAdmins(): Promise<number> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "internal_admin_users"`
  )) as any[];
  return rows[0]?.n ?? 0;
}

export async function provisionFounderFromEnv(email: string): Promise<InternalAdmin> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "internal_admin_users" (id, email, "fullName", role, "provisionedFromEnv")
     VALUES (gen_random_uuid()::text, $1, $1, 'FOUNDER', true)
     ON CONFLICT (lower(email)) DO NOTHING`,
    email.toLowerCase()
  );
  const row = await getInternalAdminByEmail(email);
  if (!row) throw new Error('failed to provision internal admin: ' + email);
  logger.info({ email: row.email }, 'internal admin self-provisioned (FOUNDER)');
  return row;
}

/* The access decision behind requireAdminRole. */
export async function resolveAdminAccess(email: string): Promise<InternalAdmin | null> {
  const existing = await getInternalAdminByEmail(email);
  if (existing) return existing.isActive ? existing : null;
  if (envAllows(email) && (await countInternalAdmins()) === 0) {
    return provisionFounderFromEnv(email);
  }
  return null;
}

export async function listInternalAdmins(): Promise<InternalAdmin[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT ${SELECT_COLS} FROM "internal_admin_users" ORDER BY "createdAt" ASC`
  )) as any[];
  return rows.map(mapRow);
}

export async function setInternalAdminActive(id: string, isActive: boolean): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "internal_admin_users" SET "isActive" = $2 WHERE id = $1`,
    id,
    isActive
  );
}

/* ─── Impersonation sessions (blueprint guardrails: ticket#, 60-min TTL) ─── */

export interface ImpersonationSession {
  id: string;
  adminEmail: string;
  tenantId: string;
  mode: string;
  ticket: string;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  ipAddress: string | null;
}

const SESSION_TTL_MINUTES = 60;
const SESSION_COLS = `id, "adminEmail", "tenantId", mode, ticket,
  "startedAt"::text AS "startedAt", "expiresAt"::text AS "expiresAt",
  "endedAt"::text AS "endedAt", "ipAddress"`;

export async function startImpersonation(input: {
  adminEmail: string;
  tenantId: string;
  mode: 'READ_ONLY' | 'FULL_WRITE';
  ticket: string;
  ip: string | null;
}): Promise<ImpersonationSession> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true },
  });
  if (!tenant) throw new Error('tenant not found: ' + input.tenantId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);
  const rows = (await prisma.$queryRawUnsafe(
    `INSERT INTO "impersonation_sessions"
       (id, "adminEmail", "tenantId", mode, ticket, "startedAt", "expiresAt", "ipAddress")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now(), $5, $6)
     RETURNING ${SESSION_COLS}`,
    input.adminEmail.toLowerCase(),
    input.tenantId,
    input.mode,
    input.ticket,
    expiresAt,
    input.ip
  )) as any[];
  logger.warn(
    { admin: input.adminEmail, tenantId: input.tenantId, mode: input.mode, ticket: input.ticket },
    'impersonation started'
  );
  return rows[0];
}

export async function endImpersonation(
  id: string,
  adminEmail: string,
  isFounder: boolean
): Promise<ImpersonationSession | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `UPDATE "impersonation_sessions" SET "endedAt" = now()
     WHERE id = $1 AND "endedAt" IS NULL AND ($2 OR lower("adminEmail") = lower($3))
     RETURNING ${SESSION_COLS}`,
    id,
    isFounder,
    adminEmail
  )) as any[];
  return rows[0] ?? null;
}

export async function activeImpersonations(adminEmail?: string): Promise<ImpersonationSession[]> {
  return (await prisma.$queryRawUnsafe(
    `SELECT ${SESSION_COLS}
     FROM "impersonation_sessions"
     WHERE "endedAt" IS NULL AND "expiresAt" > now()
       ${adminEmail ? 'AND lower("adminEmail") = lower($1)' : ''}
     ORDER BY "startedAt" DESC LIMIT 100`,
    ...(adminEmail ? [adminEmail] : [])
  )) as any[];
}
