/* apps/api/src/jobs/billing.job.ts
 * Monthly billing worker. Invoice creation lives in
 * modules/admin/sars-invoicing.service.ts since Phase 2 (2026-11-28) — one
 * SARS-shaped builder (sequential INV numbers, itemised 15% VAT, real
 * plan_catalog overage amounts) shared with the admin "generate" action.
 * This worker schedules + notifies only. */
import { enqueue, createWorker } from '../common/queue.js';
import { prisma } from '../common/prisma.js';
import { logger } from '../common/logger.js';
import { sendInvoiceEmail } from './email.queue.js';
import { createSarsInvoice } from '../modules/admin/sars-invoicing.service.js';

export const BILLING_QUEUE = 'billing';

export interface InvoiceJobData {
  tenantId: string;
  type: 'recurring' | 'one-time' | 'overage';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}

export async function generateInvoice(data: InvoiceJobData) {
  await enqueue(BILLING_QUEUE, 'generate-invoice', data);
}

export const billingWorker = createWorker<InvoiceJobData>(BILLING_QUEUE, async (job) => {
  const { tenantId, periodStart, periodEnd } = job.data;

  const invoice = await createSarsInvoice({
    tenantId,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    source: 'worker',
  });

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: { in: ['owner', 'admin'] } },
    orderBy: { createdAt: 'asc' },
  });
  if (owner?.email) {
    await sendInvoiceEmail(owner.email, invoice.id, Number(invoice.totalAmount), 'ZAR');
  }

  logger.info(
    { invoiceId: invoice.id, tenantId, total: invoice.totalAmount },
    'SARS invoice generated (worker)'
  );
});
