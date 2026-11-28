/* apps/api/src/jobs/dunning.job.ts
 * SaaS dunning ladder (Phase 2, 2026-11-28). Daily 06:05 sweep over overdue
 * invoices, max ONE email per invoice per day, escalating:
 *   day 0  — first notice (invoice flips sent -> overdue)
 *   day 3  — reminder
 *   day 7  — urgent
 *   day 14 — final warning before grace
 *   day 21 — GRACE: final notice + tenant -> past_due (PMS read-only
 *            enforcement middleware lands with the Phase 3 access work).
 * Idempotent: attempts recorded in items.dunning.attempts; one catch-up
 * step fires per sweep so a missed sweep never email-bombs a hotel.
 * Registered LAST in index.ts bootstrap (positional heartbeat labels). */
import { prisma } from '../common/prisma.js';
import { logger } from '../common/logger.js';
import { sendEmail } from './email.queue.js';
import cron from 'node-cron';

const STEPS = [
  { day: 0, tone: 'notice' },
  { day: 3, tone: 'reminder' },
  { day: 7, tone: 'urgent' },
  { day: 14, tone: 'final' },
  { day: 21, tone: 'grace' },
] as const;

export async function runDunningDay0(): Promise<number> {
  const now = new Date();
  const overdue = await prisma.invoice.findMany({
    where: { status: { in: ['sent', 'overdue'] }, dueDate: { lt: now }, totalAmount: { gt: 0 } },
    orderBy: { dueDate: 'asc' },
    take: 500,
  });
  let sent = 0;
  for (const inv of overdue as any[]) {
    const dunning = (inv.items as any)?.dunning ?? {};
    const attempts: any[] = Array.isArray(dunning.attempts) ? dunning.attempts : [];
    const daysOverdue = Math.max(
      0,
      Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400_000)
    );

    // Highest ladder step that is due and not yet attempted (one per sweep).
    const step = [...STEPS]
      .reverse()
      .find((s) => daysOverdue >= s.day && !attempts.some((a) => a.day === s.day));
    if (!step) continue;

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
        'dunning: no owner email, skipped'
      );
      continue;
    }

    const invoiceNo = (inv.items as any)?.sars?.number ?? inv.id;
    const toneSubject: Record<string, string> = {
      notice: `Payment reminder: invoice ${invoiceNo} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
      reminder: `2nd notice: invoice ${invoiceNo} remains unpaid (${daysOverdue} days)`,
      urgent: `Urgent: invoice ${invoiceNo} is ${daysOverdue} days overdue — please settle`,
      final: `Final notice: invoice ${invoiceNo} — account enters grace in 7 days`,
      grace: `Account grace: invoice ${invoiceNo} is ${daysOverdue} days overdue`,
    };
    await sendEmail({
      to: owner.email,
      subject: toneSubject[step.tone],
      template: 'generic',
      payload: {
        invoiceId: inv.id,
        invoiceNumber: invoiceNo,
        amount: Number(inv.totalAmount),
        currency: inv.currency,
        daysOverdue,
        tone: step.tone,
        viewUrl: `${process.env.WEB_URL}/app/billing/invoice/${inv.id}`,
      },
      tenantId: inv.tenantId,
      relatedType: 'invoice',
      relatedId: inv.id,
    });

    const nextAttempts = [...attempts, { day: step.day, sentAt: now.toISOString() }];
    const enteringGrace = step.day === 21 && !dunning.graceAt;
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        status: 'overdue',
        items: {
          ...(inv.items ?? {}),
          dunning: {
            ...dunning,
            attempts: nextAttempts,
            ...(enteringGrace ? { graceAt: now.toISOString() } : {}),
          },
        },
      },
    });
    if (enteringGrace) {
      await prisma.tenant.updateMany({
        where: { id: inv.tenantId, status: 'active' },
        data: { status: 'past_due' },
      });
      logger.warn(
        { invoiceId: inv.id, tenantId: inv.tenantId },
        'dunning day-21: tenant -> past_due'
      );
    }
    sent++;
  }
  logger.info({ sent, candidates: overdue.length }, 'dunning sweep complete');
  return sent;
}

export function startDunningScheduler() {
  cron.schedule('5 6 * * *', () => {
    runDunningDay0().catch((err) => logger.error(err, 'dunning sweep failed'));
  });
}
