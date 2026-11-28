/* apps/api/src/jobs/tenant-ops-daily.job.ts
 * Daily 05:10 TenantOpsDaily rollup — runs AFTER the 05:00 health snapshot
 * (it reuses those signals) and BEFORE the 06:05 dunning sweep. Registered
 * LAST in index.ts bootstrap (positional heartbeat labels). */
import { runTenantOpsDailyRollup } from '../modules/admin/ops-daily.service.js';
import { logger } from '../common/logger.js';
import cron from 'node-cron';

export async function runTenantOpsDaily(): Promise<number> {
  const written = await runTenantOpsDailyRollup();
  logger.info({ written }, 'tenant ops daily rollup complete');
  return written;
}

export function startTenantOpsDailyScheduler() {
  cron.schedule('10 5 * * *', () => {
    runTenantOpsDaily().catch((err) => logger.error(err, 'tenant-ops-daily failed'));
  });
}
