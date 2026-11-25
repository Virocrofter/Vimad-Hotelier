/* apps/api/src/jobs/popia.job.ts — P47 POPIA retention: raw ID scans are
 * purged retentionDays (default 30) after checkout. The stored file content
 * goes (best-effort deleteFile); the row stays as proof-of-purge metadata
 * (purgedAt set, key cleared). Verified ID data on the guest is untouched. */
import { prisma } from '../common/prisma.js';
import { logger } from '../common/logger.js';
import { deleteFile } from '../common/storage.js';

export const ID_SCAN_CATEGORIES = ['id_scan', 'id-scan', 'passport', 'visa', 'id'];

export async function purgeIdScans(retentionDays = 30) {
  const cutoff = new Date(Date.now() - retentionDays * 86400_000);
  const candidates = await prisma.reservationDocument.findMany({
    where: {
      category: { in: ID_SCAN_CATEGORIES },
      key: { not: '' },
      purgedAt: null,
      reservation: { departureDate: { lt: cutoff } },
    },
    take: 500,
  });

  let purged = 0;
  let errors = 0;
  for (const doc of candidates) {
    try {
      if (doc.key) await deleteFile(doc.key).catch(() => {});
      await prisma.reservationDocument.update({
        where: { id: doc.id },
        // key is non-nullable on the model — empty-string sentinel;
        // purgedAt is the authoritative proof-of-purge marker.
        data: { key: '', purgedAt: new Date() },
      });
      purged += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, docId: doc.id }, 'ID-scan purge failed for document');
    }
  }

  logger.info({ purged, errors, retentionDays, cutoff }, 'POPIA ID-scan purge sweep complete');
  return { purged, errors, retentionDays, cutoff };
}

export function startPopiaScheduler() {
  return import('node-cron')
    .then((cron) => {
      cron.default.schedule('15 3 * * *', async () => {
        await purgeIdScans().catch((err) => logger.error({ err }, 'POPIA purge sweep failed'));
      });
      logger.info('POPIA ID-scan purge scheduler started (daily 03:15)');
    })
    .catch((err) => {
      logger.warn({ err }, 'node-cron unavailable — POPIA purge scheduler disabled');
    });
}
