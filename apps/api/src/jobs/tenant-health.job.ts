/* apps/api/src/jobs/tenant-health.job.ts
 * Daily 05:00 tenant health snapshot — upserts one row per tenant into
 * tenant_health_snapshots (idempotent per tenant+date). Registered LAST in
 * index.ts because heartbeat.ts maps loop labels positionally. */
import { getTenantScores, HEALTH_WEIGHTS_VERSION } from '../modules/admin/admin.health.service.js';
import { prisma } from '../common/prisma.js';
import { logger } from '../common/logger.js';
import cron from 'node-cron';

export async function runTenantHealthSnapshot(): Promise<number> {
  const { tenants } = await getTenantScores();
  const date = new Date().toISOString().slice(0, 10);
  let written = 0;
  for (const s of tenants) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO tenant_health_snapshots (id, "tenantId", date, score, band, "subScores", triggers, "weightsVersion")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       ON CONFLICT ("tenantId", date) DO UPDATE SET
         score = $3, band = $4, "subScores" = $5::jsonb, triggers = $6::jsonb,
         "weightsVersion" = $7, "computedAt" = now()`,
      s.id,
      date,
      s.score,
      s.band,
      JSON.stringify(s.subScores),
      JSON.stringify(s.triggers),
      HEALTH_WEIGHTS_VERSION
    );
    written++;
  }
  logger.info({ written }, 'tenant health snapshot complete');
  return written;
}

// Registered LAST in index.ts bootstrap: heartbeat.ts maps loop labels
// positionally to node-cron schedule call order.
export function startTenantHealthScheduler() {
  cron.schedule('0 5 * * *', () => {
    runTenantHealthSnapshot().catch((err) => logger.error(err, 'tenant-health-snapshot failed'));
  });
}
