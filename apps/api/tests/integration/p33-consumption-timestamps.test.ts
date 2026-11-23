/* P33 — consumption-timestamp accounting: consumedAt stamped at posting,
 * corrections are rebates (reverseCharge links rebateOfId; original immutable).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let svc: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  svc = await import('../../src/modules/folios/folios.service.js');
  const mod: any = await import('../helpers/server.js');
  const agent = await mod.registerTestAgent(mod.buildTestApp?.() ?? mod.app);
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'P33',
      code: ('P33' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'P33', lastName: 'Guest', email: `p33-${runId}@example.com` },
  });
  const res = await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: g.id,
      confirmationNumber: 'P33RES' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 1000,
      balance: 0,
    },
  });
  const folio = await prisma.folio.create({
    data: { tenantId: t, reservationId: res.id, totalCharges: 0, totalPayments: 0, balance: 0 },
  });
  ctx.t = t;
  ctx.folioId = folio.id;
  console.log('P33 seeded');
}, 90000);

describe('P33 consumption-timestamp accounting', () => {
  it('S1: posting a charge stamps consumedAt (≈ postedAt)', async () => {
    const item = await svc.postCharge(ctx.t, ctx.folioId, {
      type: 'service',
      description: 'Spa treatment',
      amount: 500,
      quantity: 2,
    });
    expect(item.consumedAt).toBeTruthy();
    expect(
      Math.abs(new Date(item.consumedAt).getTime() - new Date(item.postedAt).getTime())
    ).toBeLessThan(5000);
    ctx.chargeId = item.id;
    console.log('P33 S1 OK — consumedAt stamped at posting');
  }, 60000);

  it('S2: reversal is a rebate — linked, negative, original immutable', async () => {
    const rev = await svc.reverseCharge(ctx.t, ctx.folioId, ctx.chargeId, 'guest dispute');
    expect(Number(rev.amount)).toBe(-1000);
    expect(rev.type).toBe('adjustment');
    expect(rev.rebateOfId).toBe(ctx.chargeId);
    const original = await prisma.folioItem.findFirst({ where: { id: ctx.chargeId } });
    expect(Number(original.amount)).toBe(1000);
    expect(original.description).toBe('Spa treatment');
    const folio = await prisma.folio.findFirst({ where: { id: ctx.folioId } });
    expect(Number(folio.balance)).toBe(0);
    console.log('P33 S2 OK — rebate linked, original untouched, balance nets to zero');
  }, 60000);

  it('S3: the discipline is queryable (consumed_at + rebate linking)', async () => {
    const rebates = await prisma.folioItem.findMany({
      where: { folioId: ctx.folioId, rebateOfId: { not: null } },
    });
    expect(rebates.length).toBe(1);
    const consumed = await prisma.folioItem.count({
      where: { folioId: ctx.folioId, consumedAt: { not: null } },
    });
    expect(consumed).toBeGreaterThanOrEqual(2);
    console.log('P33 S3 OK — trial balance can query consumed_at and rebate links');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
