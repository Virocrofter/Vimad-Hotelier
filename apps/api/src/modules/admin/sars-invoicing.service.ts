/* apps/api/src/modules/admin/sars-invoicing.service.ts
 * SARS-compliant SaaS invoice builder (Phase 2, 2026-11-28).
 * Single creation path for platform invoices — used by the monthly billing
 * worker AND the admin "generate" action. Sequential INV-<year>-<seq> numbers
 * (atomic per-year counter), ex-VAT line items with itemised 15% VAT,
 * real plan_catalog overage amounts. ZAR major units (2dp) per money standard.
 * Set VIMAD_VAT_NUMBER in apps/api/.env to stamp the supplier VAT number. */
import { prisma } from '../../common/prisma.js';
import { getPlan, resolvePlanFee } from './plan-catalog.service.js';
import { resolveMonthlyFee } from './contracts.service.js';

// VAT is ENV-DRIVEN: Vimad is not SARS-registered yet, so invoices legally
// cannot charge VAT. Set VIMAD_VAT_RATE=0.15 (and VIMAD_VAT_NUMBER) once SARS
// registration lands; all NEW invoices then become proper tax invoices.
export const VAT_RATE = Number(process.env.VIMAD_VAT_RATE ?? 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const vatOn = (amountEx: number) => round2(amountEx * VAT_RATE);

export interface SarsLine {
  kind: 'base' | 'usage';
  description: string;
  amountEx: number;
  vat: number;
  amountInc: number;
}

export async function createSarsInvoice(input: {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  source: 'admin' | 'worker';
}) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tenant.findUnique({ where: { id: input.tenantId } });
    if (!t) throw new Error('tenant not found: ' + input.tenantId);
    if (t.plan === 'trial') throw new Error('trial tenants are not invoiced');

    // Idempotency: never double-bill a (tenant, period).
    const existing = await tx.invoice.findFirst({
      where: { tenantId: t.id, periodStart: input.periodStart, periodEnd: input.periodEnd },
    });
    if (existing) return existing;

    const plan = t.plan.toLowerCase();
    const catalogPlan = await getPlan(plan);
    if (!catalogPlan) throw new Error('plan not in catalog: ' + plan);
    const limits = (catalogPlan.usageLimits ?? {}) as Record<string, number>;
    const rates = (catalogPlan.overageRates ?? {}) as Record<string, number>;

    const [rooms, properties] = await Promise.all([
      tx.room.count({ where: { tenantId: t.id } }),
      tx.property.count({ where: { tenantId: t.id } }),
    ]);
    const base = await resolveMonthlyFee(t.id, await resolvePlanFee(plan, rooms));

    const usageRows = await tx.usageRecord.groupBy({
      by: ['metric'],
      where: { tenantId: t.id, recordedAt: { gte: input.periodStart, lt: input.periodEnd } },
      _sum: { quantity: true },
    });
    const usage: Record<string, number> = {};
    for (const r of usageRows) usage[r.metric] = r._sum.quantity ?? 0;

    const apiCalls = usage['api_calls'] ?? 0;
    const storageBytes = usage['storage_bytes'] ?? 0;
    const smsSent = usage['sms_sent'] ?? 0;
    const apiOverageUnits = Math.max(0, Math.ceil((apiCalls - (limits.apiCalls ?? 0)) / 1000));
    const storageOverageGb = Math.max(0, storageBytes / 1024 ** 3 - (limits.storageGb ?? 0));
    const smsOverage = Math.max(0, smsSent - (limits.sms ?? 0));
    const propertyOverage = Math.max(0, properties - (limits.includedProperties ?? 0));
    const apiOverageCost = round2(apiOverageUnits * (rates.perThousandApiCalls ?? 0));
    const storageOverageCost = round2(storageOverageGb * (rates.perGbStorage ?? 0));
    const smsOverageCost = round2(smsOverage * (rates.perSms ?? 0));
    const propertyOverageCost = round2(propertyOverage * (rates.perExtraProperty ?? 0));
    const overageFee = round2(
      apiOverageCost + storageOverageCost + smsOverageCost + propertyOverageCost
    );

    const lines: SarsLine[] = [
      {
        kind: 'base',
        description: `${catalogPlan.label} plan — monthly base fee (${rooms} rooms, ${properties} propert${properties === 1 ? 'y' : 'ies'})`,
        amountEx: round2(base),
        vat: 0,
        amountInc: 0,
      },
    ];
    const pushUsage = (description: string, amount: number) => {
      if (amount > 0)
        lines.push({ kind: 'usage', description, amountEx: amount, vat: 0, amountInc: 0 });
    };
    pushUsage(`API calls overage — ${apiOverageUnits}k units`, apiOverageCost);
    pushUsage(`Storage overage — ${round2(storageOverageGb)} GB`, storageOverageCost);
    pushUsage(`SMS overage — ${smsOverage} messages`, smsOverageCost);
    pushUsage(`Additional properties — ${propertyOverage}`, propertyOverageCost);
    for (const l of lines) {
      l.vat = vatOn(l.amountEx);
      l.amountInc = round2(l.amountEx + l.vat);
    }

    const totalEx = round2(lines.reduce((s, l) => s + l.amountEx, 0));
    const vatAmount = round2(lines.reduce((s, l) => s + l.vat, 0));
    const totalInc = round2(totalEx + vatAmount);

    const year = new Date().getFullYear();
    const seqRows = await tx.$queryRawUnsafe<{ seq: number }[]>(
      `INSERT INTO saas_invoice_seq ("year", seq) VALUES ($1, 1)
       ON CONFLICT ("year") DO UPDATE SET seq = saas_invoice_seq.seq + 1
       RETURNING seq`,
      year
    );
    const number = `INV-${year}-${String(seqRows[0].seq).padStart(6, '0')}`;

    return tx.invoice.create({
      data: {
        tenantId: t.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        dueDate: new Date(input.periodEnd.getTime() + 14 * 86400_000),
        plan: t.plan,
        baseAmount: round2(base),
        overageAmount: overageFee,
        totalAmount: totalInc,
        currency: 'ZAR',
        status: 'sent',
        items: {
          sars: {
            number,
            vatRate: VAT_RATE,
            supplierVat: process.env.VIMAD_VAT_NUMBER ?? null,
            totalEx,
            vatAmount,
            totalInc,
            lines: JSON.parse(JSON.stringify(lines)),
          },
          usage: {
            apiCalls,
            storageBytes,
            smsSent,
            properties,
            rooms,
            apiOverageUnits,
            storageOverageGb: round2(storageOverageGb),
            smsOverage,
            propertyOverage,
          },
          overageFee,
          source: input.source,
        },
      },
    });
  });
}
