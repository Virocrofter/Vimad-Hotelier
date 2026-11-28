/* apps/api/src/modules/admin/plan-catalog.service.ts
 * DB-backed plan catalog (Phase 2, 2026-11-28). Replaces the deleted
 * plan-catalog.ts constants — prices/limits/rates now live in the
 * plan_catalog table and are editable without a deploy. 60s in-memory cache. */
import { prisma } from '../../common/prisma.js';
import { logger } from '../../common/logger.js';

export interface PlanRow {
  code: string;
  label: string;
  bandMinZar: number;
  bandMaxZar: number | null;
  monthlyZar: number;
  perRoomZar: number;
  includedRooms: number;
  includedFeatures: unknown;
  overageRates: unknown;
  usageLimits: unknown;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

let cache: { at: number; rows: PlanRow[] } | null = null;
const TTL_MS = 60_000;

async function loadRows(force = false): Promise<PlanRow[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT code, label, "bandMinZar", "bandMaxZar", "monthlyZar", "perRoomZar",
            "includedRooms", "includedFeatures", "overageRates", "usageLimits",
            "isActive", "sortOrder", "updatedAt"::text AS "updatedAt"
     FROM "plan_catalog" ORDER BY "sortOrder" ASC`
  )) as any[];
  const mapped = rows.map((r) => ({ ...r, isActive: Boolean(r.isActive) }));
  cache = { at: Date.now(), rows: mapped };
  return mapped;
}

export async function listPlans(): Promise<PlanRow[]> {
  return loadRows();
}

export async function getPlan(code: string): Promise<PlanRow | undefined> {
  const rows = await loadRows();
  return rows.find((r) => r.code === code.toLowerCase());
}

/* Room-bracketed list price: base + per-room over the included allowance,
 * clamped into the published band. Contract overrides still win downstream
 * (contracts.resolveMonthlyFee). Unknown plan -> 0 (never throw in a billing path). */
export async function resolvePlanFee(plan: string, rooms = 0): Promise<number> {
  const p = await getPlan(plan);
  if (!p || !p.isActive) {
    logger.warn({ plan }, 'resolvePlanFee: unknown or inactive plan');
    return 0;
  }
  const extra = Math.max(0, rooms - p.includedRooms);
  let fee = p.monthlyZar + extra * p.perRoomZar;
  if (p.bandMaxZar != null) fee = Math.min(fee, p.bandMaxZar);
  fee = Math.max(fee, p.bandMinZar);
  return fee;
}

export async function updatePlan(
  code: string,
  patch: Partial<
    Pick<
      PlanRow,
      | 'label'
      | 'bandMinZar'
      | 'bandMaxZar'
      | 'monthlyZar'
      | 'perRoomZar'
      | 'includedRooms'
      | 'isActive'
    >
  >
): Promise<PlanRow | null> {
  const existing = await getPlan(code);
  if (!existing) return null;
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (keys.length === 0) return existing;
  const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
  await prisma.$executeRawUnsafe(
    `UPDATE "plan_catalog" SET ${sets}, "updatedAt" = now() WHERE "code" = $1`,
    code.toLowerCase(),
    ...keys.map((k) => (patch as any)[k])
  );
  await loadRows(true);
  return (await getPlan(code)) ?? null;
}
