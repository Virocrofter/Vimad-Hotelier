/* apps/api/src/jobs/deposit-capture.job.ts — [A1'] advance-deposit automation.
 * Daily: for each property with autoDepositDays > 0, confirmed reservations
 * arriving in N days whose depositDue > depositPaid get the remainder captured
 * from the guest's default reusable saved card. chargeSavedCard is the single
 * posting chokepoint (folio posting, depositPaid sync, guest receipt, SARS
 * receipt) and its idempotencyKey makes re-runs safe. Demo tenants are skipped. */
import cron from 'node-cron';
import { prisma } from '../common/prisma.js';
import { logger } from '../common/logger.js';
import { isDemoTenantId } from '../common/demo-guard.js';
import { chargeSavedCard } from '../modules/payments/payments.service.js';

export async function sweepAutoDepositCaptures(now = new Date()): Promise<number> {
  const properties = await prisma.property.findMany({
    where: { autoDepositDays: { gt: 0 } },
    select: { id: true, tenantId: true, autoDepositDays: true },
  });

  let captured = 0;
  for (const prop of properties) {
    if (await isDemoTenantId(prop.tenantId)) continue;

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const target = new Date(dayStart);
    target.setDate(target.getDate() + prop.autoDepositDays);
    const nextDay = new Date(target);
    nextDay.setDate(nextDay.getDate() + 1);

    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId: prop.tenantId,
        propertyId: prop.id,
        status: 'confirmed',
        arrivalDate: { gte: target, lt: nextDay },
      },
      select: { id: true, guestId: true, depositDue: true, depositPaid: true },
      take: 200,
    });

    for (const r of reservations) {
      const due = Number(r.depositDue);
      const paid = Number(r.depositPaid);
      if (!(due > paid) || !r.guestId) continue;

      // One auto-capture per reservation ever (idempotencyKey is unique).
      const idempotencyKey = `auto-deposit-${r.id}`;
      if (await prisma.payment.findUnique({ where: { idempotencyKey } })) continue;

      const method = await prisma.guestPaymentMethod.findFirst({
        where: { tenantId: prop.tenantId, guestId: r.guestId, isActive: true, reusable: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      if (!method) {
        logger.info({ reservationId: r.id }, 'auto-deposit skipped: no reusable saved card');
        continue;
      }

      const remainingMinor = Math.round((due - paid) * 100);
      try {
        const payment = await chargeSavedCard(prop.tenantId, 'system:deposit-capture', {
          paymentMethodId: method.id,
          reservationId: r.id,
          amountMinor: remainingMinor,
          type: 'deposit',
          idempotencyKey,
        });
        if (payment.status === 'success') {
          captured += 1;
          logger.info(
            { reservationId: r.id, amountMinor: remainingMinor },
            'auto-deposit captured'
          );
        } else {
          logger.warn(
            { reservationId: r.id, failure: payment.failureReason },
            'auto-deposit capture failed — needs attention'
          );
        }
      } catch (err) {
        logger.error({ err, reservationId: r.id }, 'auto-deposit capture error');
      }
    }
  }
  return captured;
}

export function startDepositCaptureScheduler(): void {
  cron.schedule('23 6 * * *', async () => {
    try {
      await sweepAutoDepositCaptures();
    } catch (err) {
      logger.error({ err }, 'auto-deposit sweep failed');
    }
  });
  logger.info('Auto-deposit-capture scheduler started (daily 06:23)');
}
