/* apps/api/src/modules/tomsa/tomsa.service.ts — P43 TOMSA remittance summary.
 * One call per property per month: every levy line posted in the month, with
 * the property's TOMSA account reference for the remittance return. */
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';

export async function remittance(tenantId: string, q: { month?: string; propertyId?: string }) {
  if (!q.propertyId) throw new AppError(400, 'propertyId is required', 'VALIDATION_ERROR');
  const [year, mon] = String(q.month ?? '')
    .split('-')
    .map(Number);
  if (!year || !mon || mon < 1 || mon > 12) {
    throw new AppError(400, 'month must be YYYY-MM', 'VALIDATION_ERROR');
  }
  const property = await prisma.property.findFirst({ where: { id: q.propertyId, tenantId } });
  if (!property) throw new AppError(404, 'Property not found', 'NOT_FOUND');
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));
  const items = await prisma.folioItem.findMany({
    where: {
      type: 'tomsa_levy',
      postedAt: { gte: start, lt: end },
      folio: { reservation: { propertyId: q.propertyId } },
    },
    orderBy: { postedAt: 'asc' },
  });
  const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
  return {
    month: `${year}-${String(mon).padStart(2, '0')}`,
    property: {
      id: property.id,
      name: property.name,
      tomsaLevyEnabled: property.tomsaLevyEnabled,
      tomsaAccountCode: property.tomsaAccountCode,
    },
    lineCount: items.length,
    levyTotal: Math.round(total * 100) / 100,
    items: items.map((i) => ({
      id: i.id,
      amount: Number(i.amount),
      description: i.description,
      postedAt: i.postedAt,
    })),
  };
}
