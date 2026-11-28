/* apps/api/src/jobs/dunning.job.ts
 * Dunning day-0 (Phase 1): the morning an invoice crosses its due date the
 * owner gets the first reminder, the invoice flips sent -> overdue, and the
 * attempt is persisted in items.dunning.attempts so the sweep is idempotent
 * per invoice per day. Ladder days 3/7/14/21 land in Phase 2. Registered
 * LAST in index.ts (positional heartbeat labels). */
import { prisma } from '../common/prisma.js';
import { logger } from '../common/logger.js';
import { sendEmail } from './email.queue.js';
import cron from 'node-cron';

export async function runDunningDay0(): Promise<number> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const overdue = await prisma.invoice.findMany({
    where: { status: 'sent', dueDate: { lt: now }, totalAmount: { gt: 0 } },
    orderBy: { dueDate: 'asc' },
    take: 500,
  });
  let sent = 0;
  for (const inv of overdue as any[]) {
    const attempts = (inv.items as any)?.dunning?.attempts;
    const list = Array.isArray(attempts) ? attempts : [];
    if (list.some((a: any) => a.day === 0 && String(a.sentAt ?? '').slice(0, 10) === today)) {
      continue; // already reminded today
    }
    const owner =
      (await prisma.user.findFirst({
        where: { tenantId: inv.tenantId, role: { in: ['owner', 'admin'] } },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await prisma.user.findFirst({
        where: { tenantId: inv.tenantId },
        orderBy: { createdAt: 'asc' },
      }));
    if (!owner?.email) {
      logger.warn(
        { invoiceId: inv.id, tenantId: inv.tenantId },
        'dunning day-0: no owner email, skipped'
      );
      continue;
    }
    const daysOverdue = Math.max(
      0,
      Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400_000)
    );
    await sendEmail({
      to: owner.email,
      subject: `Payment reminder: invoice ${inv.id} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
      template: 'generic',
      payload: {
        invoiceId: inv.id,
        amount: Number(inv.totalAmount),
        currency: inv.currency,
        daysOverdue,
        viewUrl: `${process.env.WEB_URL}/app/billing/invoice/${inv.id}`,
      },
      tenantId: inv.tenantId,
      relatedType: 'invoice',
      relatedId: inv.id,
    });
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        status: 'overdue',
        items: {
          ...(inv.items ?? {}),
          dunning: { attempts: [...list, { day: 0, sentAt: now.toISOString() }] },
        },
      },
    });
    sent++;
  }
  logger.info({ sent, candidates: overdue.length }, 'dunning day-0 sweep complete');
  return sent;
}

// Registered LAST in index.ts bootstrap: heartbeat.ts maps loop labels
// positionally to node-cron schedule call order.
export function startDunningScheduler() {
  cron.schedule('5 6 * * *', () => {
    runDunningDay0().catch((err) => logger.error(err, 'dunning-day-0 failed'));
  });
}
