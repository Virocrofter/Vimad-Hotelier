/* C6-prime remainder: accounting export config + Xero/Pastel CSV formatters.
 * Config maps journal account prefixes (REV:<type> / RCV:<channel>) to the
 * property's real ledger codes; unmapped accounts pass through raw.
 * Export reuses the proven accounting_journal runner (persisted as a
 * TenantReportRun — audit trail by design) and formats its rows.
 * NOTE (tracker): Pastel import layouts vary by version/client — this emits
 * the common transactions layout; conform at client onboarding. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { runReport } from '../reports/reports.service.js';

export const accountingRouter = Router();
accountingRouter.use(authMiddleware, tenantScope);

function esc(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function mapAccount(prefixAccount: string, mappings: Record<string, string>): string {
  return (
    mappings[prefixAccount] ??
    mappings[prefixAccount.split(':').slice(0, 2).join(':')] ??
    prefixAccount
  );
}

// C6-prime-V: legs group under ONE journal number per (date, reference) and
// every journal must balance — Xero rejects single-sided journals. A missing
// guest-ledger leg is emitted automatically (mapped via config when present).
function groupLegs(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = String(row.date) + '|' + String(row.reference ?? '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return groups;
}

export function toXeroCsv(
  rows: Record<string, unknown>[],
  mappings: Record<string, string>
): string {
  const lines = ['JournalDate,JournalNumber,Reference,AccountCode,Description,Debits,Credits'];
  let n = 0;
  for (const [, legs] of groupLegs(rows)) {
    n++;
    let sum = 0;
    for (const leg of legs) {
      sum += Number(leg.debit) - Number(leg.credit);
      lines.push(
        [
          esc(leg.date),
          'VMD-' + n,
          esc(leg.reference),
          esc(mapAccount(String(leg.account), mappings)),
          esc(leg.description),
          Number(leg.debit).toFixed(2),
          Number(leg.credit).toFixed(2),
        ].join(',')
      );
    }
    if (Math.abs(sum) > 0.005) {
      lines.push(
        [
          esc(legs[0].date),
          'VMD-' + n,
          esc(legs[0].reference),
          esc(mappings['DEB:guest'] ?? 'DEB:guest'),
          'Guest ledger balancing leg',
          sum > 0 ? '0.00' : Math.abs(sum).toFixed(2),
          sum > 0 ? Math.abs(sum).toFixed(2) : '0.00',
        ].join(',')
      );
    }
  }
  return lines.join('\n');
}

export function toPastelCsv(
  rows: Record<string, unknown>[],
  mappings: Record<string, string>
): string {
  const lines = ['Date,Account,Reference,Description,Debit,Credit,VatIndicator'];
  for (const [, legs] of groupLegs(rows)) {
    let sum = 0;
    for (const leg of legs) {
      sum += Number(leg.debit) - Number(leg.credit);
      const acct = mapAccount(String(leg.account), mappings);
      const vat = String(leg.account).startsWith('REV:') ? 'Y' : 'N';
      lines.push(
        [
          esc(leg.date),
          esc(acct),
          esc(leg.reference),
          esc(leg.description),
          Number(leg.debit).toFixed(2),
          Number(leg.credit).toFixed(2),
          vat,
        ].join(',')
      );
    }
    if (Math.abs(sum) > 0.005) {
      lines.push(
        [
          esc(legs[0].date),
          esc(mappings['DEB:guest'] ?? 'DEB:guest'),
          esc(legs[0].reference),
          'Guest ledger balancing leg',
          sum > 0 ? '0.00' : Math.abs(sum).toFixed(2),
          sum > 0 ? Math.abs(sum).toFixed(2) : '0.00',
          'N',
        ].join(',')
      );
    }
  }
  return lines.join('\n');
}

accountingRouter.get(
  '/config',
  requirePermission('report', 'export'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = String((req.query as any).propertyId ?? '');
      if (!propertyId)
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } });
      const row = await prisma.accountingConfig.findUnique({ where: { propertyId } });
      return res.json({ data: row ?? { propertyId, mappings: {} } });
    } catch (err) {
      return next(err);
    }
  }
);

accountingRouter.put(
  '/config',
  requirePermission('report', 'export'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { propertyId, mappings } = (req.body ?? {}) as any;
      if (
        !propertyId ||
        typeof mappings !== 'object' ||
        mappings === null ||
        Array.isArray(mappings)
      ) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'propertyId and a mappings object are required',
          },
        });
      }
      const row = await prisma.accountingConfig.upsert({
        where: { propertyId: String(propertyId) },
        update: { mappings, updatedById: (req as any).auth?.user?.id ?? null },
        create: {
          propertyId: String(propertyId),
          mappings,
          updatedById: (req as any).auth?.user?.id ?? null,
        },
      });
      return res.json({ data: row });
    } catch (err) {
      return next(err);
    }
  }
);

accountingRouter.post(
  '/export',
  requirePermission('report', 'export'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { propertyId, format, dateFrom, dateTo } = (req.body ?? {}) as any;
      if (!propertyId || !['xero', 'pastel'].includes(format) || !dateFrom || !dateTo) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'propertyId, format (xero|pastel), dateFrom, dateTo are required',
          },
        });
      }
      const tenantId = (req as any).tenantId ?? (req as any).auth?.user?.tenantId;
      const run = await runReport(
        prisma,
        tenantId,
        (req as any).auth?.user?.id,
        'accounting_journal',
        {
          dateFrom: String(dateFrom),
          dateTo: String(dateTo),
          propertyId: String(propertyId),
        }
      );
      if (run.status !== 'COMPLETED') {
        return res
          .status(422)
          .json({ error: { code: 'REPORT_FAILED', message: run.error ?? 'journal run failed' } });
      }
      const cfg = await prisma.accountingConfig.findUnique({
        where: { propertyId: String(propertyId) },
      });
      const mappings = (cfg?.mappings as Record<string, string>) ?? {};
      const rows = ((run.result as any)?.rows ?? []) as Record<string, unknown>[];
      const csv = format === 'xero' ? toXeroCsv(rows, mappings) : toPastelCsv(rows, mappings);
      return res.json({ data: { csv, rowCount: rows.length, runId: run.id } });
    } catch (err) {
      return next(err);
    }
  }
);
