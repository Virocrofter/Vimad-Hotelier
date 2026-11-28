/* apps/api/src/jobs/billing.job.ts */
import { enqueue, createWorker } from '../common/queue.js';
import { prisma } from '../common/prisma.js';
import { logger } from '../common/logger.js';
import { sendInvoiceEmail } from './email.queue.js';
import { getPlan, resolvePlanFee } from '../modules/admin/plan-catalog.service.js';
import { resolveMonthlyFee } from '../modules/admin/contracts.service.js';

export const BILLING_QUEUE = 'billing';

export interface InvoiceJobData {
  tenantId: string;
  type: 'recurring' | 'one-time' | 'overage';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}

// ─── Schedule Helper ───
export async function generateInvoice(data: InvoiceJobData) {
  await enqueue(BILLING_QUEUE, 'generate-invoice', data);
}

// ─── Usage Metering Helper ───
async function getUsageForPeriod(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Record<string, number>> {
  const records = await prisma.usageRecord.groupBy({
    by: ['metric'],
    where: {
      tenantId,
      recordedAt: { gte: periodStart, lte: periodEnd },
    },
    _sum: { quantity: true },
  });

  const usage: Record<string, number> = {};
  for (const r of records) {
    usage[r.metric] = r._sum.quantity ?? 0;
  }
  return usage;
}

// ─── Plan limits/rates/base live in the DB plan_catalog table
// (Phase 2, 2026-11-28) — editable via PUT /admin/billing/plans/:code. ───

// ─── Worker ───
export const billingWorker = createWorker<InvoiceJobData>(BILLING_QUEUE, async (job) => {
  const { tenantId, type: _type, periodStart, periodEnd, dueDate } = job.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { users: { where: { role: 'owner' }, take: 1 } },
  });

  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const owner = tenant.users[0];
  const plan = tenant.plan.toLowerCase();
  const catalogPlan = await getPlan(plan);
  if (!catalogPlan) throw new Error(`Plan not in catalog: ${plan}`);
  const propertyCountForBase = await prisma.property.count({ where: { tenantId } });
  const baseRate = await resolveMonthlyFee(
    tenantId,
    await resolvePlanFee(plan, propertyCountForBase)
  );

  // ─── REAL USAGE METERING ───
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const usage = await getUsageForPeriod(tenantId, start, end);

  const limits = (catalogPlan.usageLimits ?? {}) as Record<string, number>;
  const rates = (catalogPlan.overageRates ?? {}) as Record<string, number>;

  // Calculate overages
  const apiCalls = usage['api_calls'] ?? 0;
  const storageBytes = usage['storage_bytes'] ?? 0;
  const smsSent = usage['sms_sent'] ?? 0;
  const propertyCount = await prisma.property.count({ where: { tenantId } });

  const apiOverageUnits = Math.max(0, Math.ceil((apiCalls - limits.apiCalls) / 1000));
  const storageOverageGb = Math.max(0, storageBytes / 1024 ** 3 - limits.storageGb);
  const smsOverage = Math.max(0, smsSent - limits.sms);
  const propertyOverage = Math.max(0, propertyCount - limits.includedProperties);

  const apiOverageCost = apiOverageUnits * rates.perThousandApiCalls;
  const storageOverageCost = Math.round(storageOverageGb * rates.perGbStorage * 100) / 100;
  const smsOverageCost = smsOverage * rates.perSms;
  const propertyOverageCost = propertyOverage * rates.perExtraProperty;

  const overageFee =
    Math.round((apiOverageCost + storageOverageCost + smsOverageCost + propertyOverageCost) * 100) /
    100;
  const total = Math.round((baseRate + overageFee) * 100) / 100;

  // Create invoice record
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        tenantId,
        customerId: owner?.id,
        plan: tenant.plan,
        periodStart: start,
        periodEnd: end,
        dueDate: new Date(dueDate),
        baseAmount: baseRate,
        overageAmount: overageFee,
        totalAmount: total,
        currency: 'ZAR',
        status: 'sent',
        items: {
          plan: tenant.plan,
          baseRate,
          usage: {
            apiCalls,
            apiCallsLimit: limits.apiCalls,
            apiOverageUnits,
            apiOverageCost,
            storageBytes,
            storageLimitGb: limits.storageGb,
            storageOverageGb: Math.round(storageOverageGb * 100) / 100,
            storageOverageCost,
            smsSent,
            smsLimit: limits.sms,
            smsOverage,
            smsOverageCost,
            propertyCount,
            includedProperties: limits.includedProperties,
            propertyOverage,
            propertyOverageCost,
          },
          overageFee,
          total,
          periodStart,
          periodEnd,
        } as any,
      },
    });

    return inv;
  });

  // Send email notification
  if (owner) {
    await sendInvoiceEmail(owner.email, invoice.id, total, 'ZAR');
  }

  logger.info(
    { invoiceId: invoice.id, tenantId, total, baseRate, overageFee, usage },
    'invoice generated with real usage metering'
  );
});
