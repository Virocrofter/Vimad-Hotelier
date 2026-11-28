// Production-grade system health: live platform signals, scheduler dead-man
// grid, synthetic probes, per-tenant health scores, guest-journey SLIs,
// nightly batch-job panel, and auto-opened incidents.
import { getRedisClient } from '../../common/queue.js';
import { prisma } from '../../common/prisma.js';
import { logger } from '../../common/logger.js';
import { LOOPS } from '../../common/heartbeat.js';

const startedAt = Date.now();
const fmtUptime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
};

async function q<T>(sql: string, ...params: any[]): Promise<T> {
  return prisma.$queryRawUnsafe(sql, ...params) as Promise<T>;
}

// ── Overview: real signals only ──
export async function getHealthOverview() {
  const t0 = Date.now();
  let db: { status: string; latencyMs: number } = { status: 'operational', latencyMs: 0 };
  try {
    await q('SELECT 1');
    db.latencyMs = Date.now() - t0;
  } catch {
    db = { status: 'critical', latencyMs: Date.now() - t0 };
  }

  let redis: { status: string; latencyMs: number } = { status: 'degraded', latencyMs: 0 };
  const client = getRedisClient();
  if (client) {
    const r0 = Date.now();
    try {
      await client.ping();
      redis = { status: 'operational', latencyMs: Date.now() - r0 };
    } catch {
      redis = { status: 'critical', latencyMs: Date.now() - r0 };
    }
  }

  const [openIncidents, failedJobs, openExceptions, hbRows] = await Promise.all([
    q<any[]>(
      `SELECT count(*)::int AS c FROM "incidents" WHERE "status" NOT IN ('resolved','closed')`
    ),
    q<any[]>(`SELECT count(*)::int AS c FROM "failed_jobs" WHERE "status" = 'pending'`),
    q<any[]>(`SELECT count(*)::int AS c FROM "exceptions" WHERE "status" = 'open'`),
    q<any[]>(`SELECT "name", "ranAt" FROM "scheduler_heartbeats"`),
  ]);
  const hbMap = Object.fromEntries(hbRows.map((r: any) => [r.name, new Date(r.ranAt)]));
  const stale = LOOPS.filter((l) => {
    const last = hbMap[l.label];
    return !last || Date.now() - last.getTime() > l.expectedMs * 2;
  }).map((l) => l.label);

  const mem = process.memoryUsage();
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (db.status === 'critical' || redis.status === 'critical' || stale.length > 0)
    status = 'critical';
  else if (redis.status === 'degraded' || failedJobs[0].c > 20 || openExceptions[0].c > 50)
    status = 'degraded';

  const services = [
    {
      name: 'Database',
      status: db.status,
      latencyMs: db.latencyMs,
      detail: 'PostgreSQL via Prisma (SELECT 1)',
    },
    {
      name: 'Redis / Queue',
      status: redis.status,
      latencyMs: redis.latencyMs,
      detail: client ? 'ioredis ping' : 'no redis client configured',
    },
    {
      name: 'Cron Loops',
      status: stale.length === 0 ? 'operational' : 'critical',
      latencyMs: 0,
      detail: stale.length === 0 ? 'all loops checking in' : `stale: ${stale.join(', ')}`,
    },
    {
      name: 'API Server',
      status: 'operational',
      latencyMs: 0,
      detail: `uptime ${fmtUptime(Date.now() - startedAt)} | heap ${Math.round(mem.heapUsed / 1048576)}MB`,
    },
    {
      name: 'Job Queue (DLQ)',
      status: failedJobs[0].c > 50 ? 'critical' : failedJobs[0].c > 0 ? 'degraded' : 'operational',
      latencyMs: 0,
      detail: `${failedJobs[0].c} dead-lettered jobs awaiting retry`,
    },
  ];

  return {
    status,
    generatedAt: new Date().toISOString(),
    uptime: fmtUptime(Date.now() - startedAt),
    openIncidents: openIncidents[0].c,
    openExceptions: openExceptions[0].c,
    staleLoops: stale,
    services,
  };
}

// ── Heartbeat grid ──
export async function getHeartbeats() {
  const rows = await q<any[]>(
    `SELECT "name","ranAt","durationMs","itemsProcessed","error" FROM "scheduler_heartbeats" ORDER BY "name"`
  );
  const byName = new Map(rows.map((r) => [r.name, r]));
  const tiles = LOOPS.map((l) => {
    const r = byName.get(l.label);
    const ageMs = r ? Date.now() - new Date(r.ranAt).getTime() : null;
    const status =
      ageMs === null
        ? 'silent'
        : ageMs <= l.expectedMs * 2
          ? 'ok'
          : ageMs <= l.expectedMs * 4
            ? 'stale'
            : 'dead';
    return {
      name: l.label,
      expectedMs: l.expectedMs,
      status,
      ageMs,
      ranAt: r?.ranAt ?? null,
      durationMs: r?.durationMs ?? 0,
      error: r?.error ?? null,
    };
  });
  const extra = rows
    .filter((r) => !LOOPS.some((l) => l.label === r.name))
    .map((r) => ({
      name: r.name,
      expectedMs: null,
      status: 'ok',
      ageMs: Date.now() - new Date(r.ranAt).getTime(),
      ranAt: r.ranAt,
      durationMs: r.durationMs,
      error: r.error,
    }));
  return { tiles: [...tiles, ...extra] };
}

// ── Synthetic probes ──
async function runBookingProbe() {
  const t0 = Date.now();
  try {
    const props = await q<any[]>(
      `SELECT p."id", p."name", count(r."id")::int AS rooms, count(rp."id")::int AS rate_plans
       FROM "properties" p
       LEFT JOIN "rooms" r ON r."propertyId" = p."id"
       LEFT JOIN "rate_plans" rp ON rp."propertyId" = p."id" AND rp."status" = 'active'
       WHERE p."status" = 'active' GROUP BY p."id", p."name" LIMIT 1`
    );
    if (!props[0] || props[0].rooms === 0)
      return {
        status: 'fail',
        latencyMs: Date.now() - t0,
        detail: 'no active property with rooms',
        error: 'inventory empty',
      };
    return {
      status: 'pass',
      latencyMs: Date.now() - t0,
      detail: `${props[0].name}: ${props[0].rooms} rooms, ${props[0].rate_plans} active rate plans`,
    };
  } catch (e: any) {
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      detail: null,
      error: String(e?.message || e),
    };
  }
}

async function runPortalProbe() {
  const t0 = Date.now();
  try {
    const g = await q<any[]>(`SELECT count(*)::int AS c FROM "guests" WHERE "email" IS NOT NULL`);
    const s = await q<any[]>(`SELECT count(*)::int AS c FROM "guest_checkin_sessions"`);
    return {
      status: 'pass',
      latencyMs: Date.now() - t0,
      detail: `${g[0].c} guests with email | ${s[0].c} check-in sessions on record`,
    };
  } catch (e: any) {
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      detail: null,
      error: String(e?.message || e),
    };
  }
}

async function runWebhookProbe() {
  const t0 = Date.now();
  try {
    const r = await q<any[]>(
      `SELECT count(*)::int AS ok, max("postedAt") AS last_post
       FROM "payments" WHERE "status" = 'success' AND "createdAt" > now() - interval '24 hours'`
    );
    const ok = r[0].ok > 0;
    return {
      status: ok ? 'pass' : 'warn',
      latencyMs: Date.now() - t0,
      detail: ok
        ? `${r[0].ok} successful payments in 24h | last folio post ${r[0].last_post ?? 'n/a'}`
        : 'no successful payments in 24h (ok if quiet)',
      error: null,
    };
  } catch (e: any) {
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      detail: null,
      error: String(e?.message || e),
    };
  }
}

const PROBES = [
  { key: 'booking-engine', label: 'Booking Engine', fn: runBookingProbe },
  { key: 'guest-portal', label: 'Guest Portal', fn: runPortalProbe },
  { key: 'payments-webhook', label: 'Payments / Webhooks', fn: runWebhookProbe },
];

export async function runProbes() {
  const results = [];
  for (const p of PROBES) {
    const r = await p.fn();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "health_checks" ("id","probe","status","latencyMs","detail","error","ranAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, now())`,
      p.key,
      r.status,
      r.latencyMs,
      r.detail,
      r.error
    );
    results.push({ probe: p.key, label: p.label, ...r, ranAt: new Date().toISOString() });
  }
  await maybeAutoIncident(results);
  return { results };
}

export async function getProbes() {
  const rows = await q<any[]>(
    `SELECT DISTINCT ON ("probe") "probe","status","latencyMs","detail","error","ranAt"
     FROM "health_checks" ORDER BY "probe", "ranAt" DESC`
  );
  return {
    results: PROBES.map((p) => {
      const r = rows.find((x) => x.probe === p.key);
      return r
        ? {
            probe: p.key,
            label: p.label,
            status: r.status,
            latencyMs: r.latencyMs,
            detail: r.detail,
            error: r.error,
            ranAt: r.ranAt,
          }
        : {
            probe: p.key,
            label: p.label,
            status: 'never_run',
            latencyMs: 0,
            detail: 'press Run probes',
            error: null,
            ranAt: null,
          };
    }),
  };
}

// ── Auto-open incidents from thresholds ──
async function maybeAutoIncident(probeResults: any[]) {
  const reasons: string[] = [];
  const failing = probeResults.filter((p) => p.status === 'fail');
  if (failing.length) reasons.push(`probe failures: ${failing.map((f) => f.probe).join(', ')}`);
  const stale = await q<any[]>(
    `SELECT "name" FROM "scheduler_heartbeats" WHERE "ranAt" < now() - interval '2 hours'`
  );
  if (stale.length) reasons.push(`stale cron loops: ${stale.map((s: any) => s.name).join(', ')}`);
  if (!reasons.length) {
    // self-healing: resolve zombie auto-detected incidents once health returns
    await prisma.$executeRawUnsafe(
      `UPDATE "incidents" SET "status"='resolved', "updatedAt"=now() WHERE "title" LIKE 'Auto-detected: %' AND "status" NOT IN ('resolved','closed')`
    );
    return;
  }
  const title = `Auto-detected: ${reasons.join('; ')}`.slice(0, 200);
  const exists = await q<any[]>(
    `SELECT 1 FROM "incidents" WHERE "title" = $1 AND "status" NOT IN ('resolved','closed') LIMIT 1`,
    title
  );
  if (exists.length) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "incidents" ("id","severity","title","status","timeline","createdBy","createdAt","updatedAt")
     VALUES (gen_random_uuid()::text, 'high', $1, 'investigating', '[]', 'health-monitor', now(), now())`,
    title
  );
  logger.warn({ title }, 'auto-incident opened');
}

// ── Incidents CRUD (existing P10 incidents table) ──
export async function getIncidents() {
  return q<any[]>(`SELECT * FROM "incidents" ORDER BY "startedAt" DESC LIMIT 100`);
}
export async function createIncident(input: { title: string; severity: string; detail?: string }) {
  const row = await q<any[]>(
    `INSERT INTO "incidents" ("id","severity","title","status","timeline","createdBy","createdAt","updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'investigating', '[]', 'platform_admin', now(), now()) RETURNING *`,
    input.severity,
    input.title
  );
  return row[0];
}
export async function updateIncident(id: string, patch: { status?: string; note?: string }) {
  if (patch.status) {
    await prisma.$executeRawUnsafe(
      `UPDATE "incidents" SET "status" = $1,
         "resolvedAt" = CASE WHEN $1 IN ('resolved','closed') THEN now() ELSE "resolvedAt" END,
         "timeline" = "timeline" || jsonb_build_object('at', now(), 'status', $1, 'note', $2),
         "updatedAt" = now() WHERE "id" = $3`,
      patch.status,
      patch.note ?? null,
      id
    );
  }
  return q<any[]>(`SELECT * FROM "incidents" WHERE "id" = $1`, id);
}

// ── Per-tenant health score v2 (2026-11-28) ──
// v1 bug: 100-minus-deductions meant a dead hotel (no payments, no emails,
// no exceptions) scored 100 GREEN, and the platform-global failed_jobs count
// was deducted from EVERY tenant. v2 is a weighted 0-100 model over real
// usage/logins/ops/billing signals plus hard churn triggers.
// Weights are hypotheses — govern weekly; bump HEALTH_WEIGHTS_VERSION on change.
export const HEALTH_WEIGHTS = { usage: 0.4, logins: 0.3, ops: 0.2, billing: 0.1 };
export const HEALTH_WEIGHTS_VERSION = 'v2-2026-11-28';
const BAND_GREEN_MIN = 75; // design doc: Green >= 75 / Amber 50-74 / Red < 50
const ONBOARDING_GRACE_DAYS = 14;

export type HealthBand = 'green' | 'amber' | 'red' | 'new';

export function band(score: number): HealthBand {
  return score >= BAND_GREEN_MIN ? 'green' : score >= 50 ? 'amber' : 'red';
}

interface TenantSignalRow {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  createdAt: string | Date;
  pay_ok: number;
  pay_bad: number;
  pay_total: number;
  email_sent: number;
  email_total: number;
  reservations_30d: number;
  exceptions_open: number;
  exceptions_24h: number;
  logins_7d: number;
  overdueInvoice: boolean;
}

async function getTenantSignalRows(): Promise<TenantSignalRow[]> {
  const overdueRows = await prisma.invoice.findMany({
    where: {
      status: { in: ['sent', 'overdue'] },
      dueDate: { lt: new Date() },
      totalAmount: { gt: 0 },
    },
    select: { tenantId: true },
  });
  const overdueSet = new Set(overdueRows.map((r) => r.tenantId));
  const rows = await q<any[]>(`
    WITH pay AS (
      SELECT "tenantId",
        count(*) FILTER (WHERE "status" = 'success')::int AS ok,
        count(*) FILTER (WHERE "status" IN ('failed','cancelled'))::int AS bad,
        count(*)::int AS total
      FROM "payments" WHERE "createdAt" > now() - interval '30 days' GROUP BY "tenantId"
    ),
    email AS (
      SELECT "tenantId",
        count(*) FILTER (WHERE "status" = 'sent')::int AS sent,
        count(*)::int AS total
      FROM "email_logs" WHERE "createdAt" > now() - interval '30 days' GROUP BY "tenantId"
    ),
    res AS (
      SELECT p."tenantId", count(r."id")::int AS made
      FROM "reservations" r JOIN "properties" p ON p."id" = r."propertyId"
      WHERE r."createdAt" > now() - interval '30 days' GROUP BY p."tenantId"
    ),
    exc AS (
      SELECT "tenantId",
        count(*) FILTER (WHERE "status" = 'open')::int AS open,
        count(*) FILTER (WHERE "status" = 'open' AND "createdAt" >= now() - interval '24 hours')::int AS fresh24
      FROM "exceptions" GROUP BY "tenantId"
    ),
    login AS (
      SELECT "tenantId", count(*)::int AS n FROM "auth_events"
      WHERE "at" >= now() - interval '7 days' GROUP BY "tenantId"
    )
    SELECT t."id", t."name", t."slug", t."plan", t."status", t."createdAt",
      COALESCE(pay.ok,0) AS pay_ok, COALESCE(pay.bad,0) AS pay_bad, COALESCE(pay.total,0) AS pay_total,
      COALESCE(email.sent,0) AS email_sent, COALESCE(email.total,0) AS email_total,
      COALESCE(res.made,0) AS reservations_30d,
      COALESCE(exc.open,0) AS exceptions_open, COALESCE(exc.fresh24,0) AS exceptions_24h,
      COALESCE(login.n,0) AS logins_7d
    FROM "tenants" t
    LEFT JOIN pay ON pay."tenantId" = t."id"
    LEFT JOIN email ON email."tenantId" = t."id"
    LEFT JOIN res ON res."tenantId" = t."id"
    LEFT JOIN exc ON exc."tenantId" = t."id"
    LEFT JOIN login ON login."tenantId" = t."id"
    ORDER BY t."createdAt" DESC LIMIT 500`);
  return rows.map((r) => ({ ...r, overdueInvoice: overdueSet.has(r.id) }));
}

interface SubScores {
  usage: number;
  logins: number;
  ops: number;
  billing: number;
}

function computeScore(s: TenantSignalRow): {
  score: number;
  band: HealthBand;
  triggers: string[];
  subScores: SubScores;
} {
  const payRate = s.pay_total > 0 ? s.pay_ok / s.pay_total : 0;
  const emailRate = s.email_total > 0 ? s.email_sent / s.email_total : 0;
  const resActivity = Math.min(1, s.reservations_30d / 10);
  const usage = Math.round(100 * (0.45 * payRate + 0.25 * emailRate + 0.3 * resActivity));
  const logins = Math.min(100, Math.round((s.logins_7d / 5) * 100));
  const ops = Math.max(
    0,
    100 - Math.min(60, s.exceptions_open * 5) - Math.min(40, s.exceptions_24h * 20)
  );
  const billingBase: Record<string, number> = {
    active: 100,
    trial: 70,
    past_due: 20,
    suspended: 20,
    cancelled: 0,
    inactive: 0,
  };
  const billing = s.overdueInvoice
    ? Math.max(0, (billingBase[s.status] ?? 50) - 20)
    : (billingBase[s.status] ?? 50);
  let score = Math.round(
    usage * HEALTH_WEIGHTS.usage +
      logins * HEALTH_WEIGHTS.logins +
      ops * HEALTH_WEIGHTS.ops +
      billing * HEALTH_WEIGHTS.billing
  );
  const triggers: string[] = [];
  if (s.overdueInvoice) triggers.push('overdue-invoice');
  const paying = s.status === 'active' || s.status === 'trial';
  if (paying && s.logins_7d === 0) triggers.push('no-logins-7d');
  if (
    paying &&
    s.logins_7d === 0 &&
    s.reservations_30d === 0 &&
    s.pay_total === 0 &&
    s.email_total === 0
  ) {
    score = Math.min(score, 30); // a dead tenant can never look healthy
    triggers.push('no-activity-30d');
  }
  const isNew = Date.now() - new Date(s.createdAt).getTime() < ONBOARDING_GRACE_DAYS * 86400_000;
  return {
    score,
    band: isNew ? 'new' : band(score),
    triggers,
    subScores: { usage, logins, ops, billing },
  };
}

export async function getTenantScores() {
  const rows = await getTenantSignalRows();
  return {
    tenants: rows.map((s) => {
      const r = computeScore(s);
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        plan: s.plan,
        status: s.status,
        score: r.score,
        band: r.band,
        triggers: r.triggers,
        subScores: r.subScores,
        weightsVersion: HEALTH_WEIGHTS_VERSION,
        logins7d: s.logins_7d,
        payments30d: s.pay_total,
        emails30d: s.email_total,
        exceptions24h: s.exceptions_24h,
      };
    }),
  };
}

export async function getTenantHealthDetail(tenantId: string) {
  const { tenants } = await getTenantScores();
  const t = tenants.find((r) => r.id === tenantId);
  if (!t) throw new Error('tenant not found');
  const [payments, emails, exceptions, audits, failedJobs, streakRows, snapshots] =
    await Promise.all([
      q<any[]>(
        `SELECT "status", count(*)::int AS c FROM "payments"
         WHERE "tenantId" = $1 AND "createdAt" > now() - interval '30 days' GROUP BY "status"`,
        tenantId
      ),
      q<any[]>(
        `SELECT "status", count(*)::int AS c FROM "email_logs"
         WHERE "tenantId" = $1 AND "createdAt" > now() - interval '30 days' GROUP BY "status"`,
        tenantId
      ),
      q<any[]>(
        `SELECT "type","severity","title","createdAt" FROM "exceptions"
         WHERE "tenantId" = $1 AND "status" = 'open' ORDER BY "createdAt" DESC LIMIT 20`,
        tenantId
      ),
      q<any[]>(
        `SELECT na."auditDate", na."status", p."name" AS property FROM "night_audits" na
         JOIN "properties" p ON p."id" = na."propertyId"
         WHERE p."tenantId" = $1 ORDER BY na."auditDate" DESC LIMIT 14`,
        tenantId
      ),
      q<any[]>(
        `SELECT "jobName","queue","failReason","createdAt" FROM "failed_jobs"
         WHERE "createdAt" > now() - interval '24 hours' ORDER BY "createdAt" DESC LIMIT 20`
      ),
      q<any[]>(
        `WITH ordered AS (
           SELECT date, band FROM "tenant_health_snapshots"
           WHERE "tenantId" = $1 ORDER BY date DESC LIMIT 60
         )
         SELECT count(*)::int AS streak FROM ordered
         WHERE band = 'red'
           AND date >= (SELECT coalesce(max(date), '1970-01-01'::date) FROM ordered WHERE band <> 'red')`,
        tenantId
      ),
      getTenantSnapshots(tenantId, 30),
    ]);
  return {
    payments,
    emails,
    exceptions,
    audits,
    failedJobs,
    healthScore: t.score,
    band: t.band,
    triggers: t.triggers,
    subScores: t.subScores,
    weightsVersion: HEALTH_WEIGHTS_VERSION,
    logins7d: t.logins7d,
    emails30d: t.emails30d,
    exceptions24h: t.exceptions24h,
    failedJobs30d: 0, // v1 platform-global deduction removed: no per-tenant source exists
    consecutiveRedDays: streakRows[0]?.streak ?? 0,
    sparkline: snapshots.map((x: any) => x.score),
  };
}

export async function getTenantSnapshots(tenantId: string, days = 30) {
  return q<any[]>(
    `SELECT date::text AS date, score, band, "subScores", triggers, "weightsVersion"
     FROM "tenant_health_snapshots" WHERE "tenantId" = $1
     ORDER BY date DESC LIMIT $2`,
    tenantId,
    Math.min(365, Math.max(1, days))
  );
}

// ── Guest-journey SLIs per property ──
export async function getJourneys() {
  return q<any[]>(`
    SELECT p."id" AS "propertyId", p."tenantId" AS "tenantId", p."name",
      (SELECT count(*)::int FROM "guest_checkin_sessions" s WHERE s."propertyId" = p."id"
        AND s."createdAt" > now() - interval '30 days') AS checkins_started,
      (SELECT count(*)::int FROM "guest_checkin_sessions" s WHERE s."propertyId" = p."id"
        AND s."completedAt" IS NOT NULL AND s."createdAt" > now() - interval '30 days') AS checkins_done,
      (SELECT count(*)::int FROM "payment_requests" pr JOIN "reservations" r ON r."id" = pr."reservationId"
        WHERE r."propertyId" = p."id" AND pr."createdAt" > now() - interval '30 days') AS payreq_total,
      (SELECT count(*)::int FROM "payment_requests" pr JOIN "reservations" r ON r."id" = pr."reservationId"
        WHERE r."propertyId" = p."id" AND pr."status" = 'paid' AND pr."createdAt" > now() - interval '30 days') AS payreq_paid,
      (SELECT count(*)::int FROM "guest_orders" o WHERE o."propertyId" = p."id"
        AND o."createdAt" > now() - interval '30 days') AS orders_total,
      (SELECT count(*)::int FROM "guest_orders" o WHERE o."propertyId" = p."id"
        AND o."status" = 'delivered' AND o."createdAt" > now() - interval '30 days') AS orders_delivered
    FROM "properties" p WHERE p."status" = 'active' ORDER BY p."name" LIMIT 200`);
}

// ── Nightly batch panel ──
export async function getNightly() {
  const [cache, reportFails, mealErrors, hb] = await Promise.all([
    q<any[]>(
      `SELECT max("computedAt") AS freshest, count(*)::int AS rows FROM "inventory_daily_cache"`
    ),
    q<any[]>(
      `SELECT count(*)::int AS c FROM "report_runs" WHERE "status" = 'failed' AND "startedAt" > now() - interval '24 hours'`
    ),
    q<any[]>(
      `SELECT count(*)::int AS c FROM "meal_plan_postings" WHERE "status" = 'failed' AND "createdAt" > now() - interval '24 hours'`
    ),
    q<any[]>(`SELECT "name","ranAt","error" FROM "scheduler_heartbeats"
              WHERE "name" IN ('inventory-cache','wakeup-digest','hk-overnight','overbooking-alerts','ar-dunning','scheduled-reports')`),
  ]);
  const ageMs = cache[0].freshest ? Date.now() - new Date(cache[0].freshest).getTime() : null;
  return {
    inventoryCache: {
      rows: cache[0].rows,
      freshest: cache[0].freshest,
      ageMs,
      fresh: ageMs !== null && ageMs < 86400000,
    },
    reportFailures24h: reportFails[0].c,
    mealPostingFailures24h: mealErrors[0].c,
    nightlyLoops: hb,
  };
}
