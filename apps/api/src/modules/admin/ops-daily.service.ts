/* apps/api/src/modules/admin/ops-daily.service.ts
 * TenantOpsDaily rollup + fleet reads (Phase 2, 2026-11-28 — agreed fix F-A20).
 * One row per tenant per day: MRR resolved the same way billing resolves it
 * (contract wins, else DB plan_catalog room-bracketed fee), plus footprint and
 * health signals. Churn/expansion math runs OFF THIS TABLE (day-over-day
 * deltas) — never against OLTP tables. */
import { prisma } from '../../common/prisma.js';
import { getTenantScores } from './admin.health.service.js';
import { resolvePlanFee } from './plan-catalog.service.js';
import { resolveMonthlyFee } from './contracts.service.js';

export async function runTenantOpsDailyRollup(): Promise<number> {
  const { tenants } = await getTenantScores();
  const [roomCounts, propCounts] = await Promise.all([
    prisma.room.groupBy({ by: ['tenantId'], _count: { tenantId: true } }),
    prisma.property.groupBy({ by: ['tenantId'], _count: { tenantId: true } }),
  ]);
  const roomsMap = new Map(roomCounts.map((r) => [r.tenantId, r._count.tenantId]));
  const propsMap = new Map(propCounts.map((r) => [r.tenantId, r._count.tenantId]));
  const date = new Date().toISOString().slice(0, 10);
  let written = 0;
  for (const t of tenants) {
    const rooms = roomsMap.get(t.id) ?? 0;
    const properties = propsMap.get(t.id) ?? 0;
    const mrr = await resolveMonthlyFee(t.id, await resolvePlanFee(t.plan, rooms));
    const mrrCents = Math.round(mrr * 100);
    await prisma.$executeRawUnsafe(
      `INSERT INTO tenant_ops_daily
         (id, date, "tenantId", status, plan, "mrrCents", rooms, properties,
          "healthScore", "healthBand", "logins7d", "exceptions24h")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT ("tenantId", date) DO UPDATE SET
         status = $3, plan = $4, "mrrCents" = $5, rooms = $6, properties = $7,
         "healthScore" = $8, "healthBand" = $9, "logins7d" = $10, "exceptions24h" = $11`,
      date,
      t.id,
      t.status,
      t.plan,
      mrrCents,
      rooms,
      properties,
      t.score,
      t.band,
      t.logins7d,
      t.exceptions24h
    );
    written++;
  }
  return written;
}

/* Fleet series + day-over-day MRR movement (new / expansion / contraction /
 * churned), computed between consecutive available days. Approximation by
 * design: "churned" = row existed yesterday and not today. */
export async function getFleetDaily(days = 30) {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT date::text AS date, "tenantId", status, "mrrCents", "healthBand", rooms, "healthScore"
     FROM "tenant_ops_daily"
     WHERE date >= current_date - make_interval(days => $1)
     ORDER BY date ASC`,
    Math.min(365, Math.max(2, days))
  )) as any[];

  const byDay = new Map<string, any[]>();
  for (const r of rows) {
    if (!byDay.has(r.date)) byDay.set(r.date, []);
    byDay.get(r.date)!.push(r);
  }
  const dates = [...byDay.keys()].sort();
  const series = dates.map((d) => {
    const list = byDay.get(d)!;
    return {
      date: d,
      mrrCents: list.reduce((s: number, r: any) => s + r.mrrCents, 0),
      tenants: list.length,
      rooms: list.reduce((s: number, r: any) => s + (r.rooms ?? 0), 0),
      redTenants: list.filter((r: any) => r.healthBand === 'red').length,
      avgHealth: Math.round(
        list.reduce((s: number, r: any) => s + (r.healthScore ?? 0), 0) / Math.max(1, list.length)
      ),
    };
  });

  let movement = null;
  if (dates.length >= 2) {
    const prev = new Map(byDay.get(dates[dates.length - 2])!.map((r: any) => [r.tenantId, r]));
    const curr = new Map(byDay.get(dates[dates.length - 1])!.map((r: any) => [r.tenantId, r]));
    let newCents = 0;
    let expansionCents = 0;
    let contractionCents = 0;
    let churnedCents = 0;
    let newCount = 0;
    let churnedCount = 0;
    for (const [id, c] of curr) {
      const p = prev.get(id);
      if (!p) {
        newCents += c.mrrCents;
        newCount++;
      } else if (c.mrrCents > p.mrrCents) {
        expansionCents += c.mrrCents - p.mrrCents;
      } else if (c.mrrCents < p.mrrCents) {
        contractionCents += p.mrrCents - c.mrrCents;
      }
    }
    for (const [id, p] of prev) {
      if (!curr.has(id)) {
        churnedCents += p.mrrCents;
        churnedCount++;
      }
    }
    movement = {
      date: dates[dates.length - 1],
      newCents,
      newCount,
      expansionCents,
      contractionCents,
      churnedCents,
      churnedCount,
      netCents: newCents + expansionCents - contractionCents - churnedCents,
    };
  }
  // Live dunning position (not part of the daily rollup - invoice state).
  const overdueAgg = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    _count: { id: true },
    where: {
      status: { in: ['sent', 'overdue'] },
      dueDate: { lt: new Date() },
      totalAmount: { gt: 0 },
    },
  });
  const dunning = {
    overdueCents: Math.round(Number(overdueAgg._sum.totalAmount ?? 0) * 100),
    count: overdueAgg._count.id,
  };
  return { series, movement, dunning };
}

export async function getTenantDaily(tenantId: string, days = 90) {
  return (await prisma.$queryRawUnsafe(
    `SELECT date::text AS date, "mrrCents", rooms, properties, "healthScore",
            "healthBand", "logins7d", status, plan
     FROM "tenant_ops_daily" WHERE "tenantId" = $1
     ORDER BY date ASC LIMIT $2`,
    tenantId,
    Math.min(365, Math.max(2, days))
  )) as any[];
}
