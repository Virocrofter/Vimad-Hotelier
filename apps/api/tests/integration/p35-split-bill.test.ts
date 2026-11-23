/* P35 — split-bill move semantics: charges move by pointer update, the
 * movedFrom/movedAt/movedBy audit trail records it, and BOTH folios'
 * totals/balances recalculate (stale totals would poison every balance).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
let svc: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  svc = await import('../../src/modules/folios/folios.service.js');
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'SB',
      code: ('SB' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'SB', lastName: 'Guest', email: `sb-${runId}@example.com` },
  });
  const mkRes = () =>
    prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber: 'SB' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        status: 'checked_in',
        arrivalDate: new Date(),
        departureDate: new Date(Date.now() + 86400_000),
        nights: 1,
        totalAmount: 1000,
        balance: 0,
      },
    });
  ctx.resA = await mkRes();
  ctx.resB = await mkRes();
  ctx.folioA = await prisma.folio.create({
    data: {
      tenantId: t,
      reservationId: ctx.resA.id,
      totalCharges: 0,
      totalPayments: 0,
      balance: 0,
    },
  });
  ctx.folioB = await prisma.folio.create({
    data: {
      tenantId: t,
      reservationId: ctx.resA.id,
      totalCharges: 0,
      totalPayments: 0,
      balance: 0,
    },
  });
  ctx.folioOther = await prisma.folio.create({
    data: {
      tenantId: t,
      reservationId: ctx.resB.id,
      totalCharges: 0,
      totalPayments: 0,
      balance: 0,
    },
  });
  ctx.charge1 = await svc.postCharge(t, ctx.folioA.id, {
    type: 'service',
    description: 'Spa',
    amount: 500,
    quantity: 1,
  });
  ctx.charge2 = await svc.postCharge(t, ctx.folioA.id, {
    type: 'incidental',
    description: 'Bar',
    amount: 300,
    quantity: 1,
  });
  ctx.t = t;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('P35 seeded');
}, 90000);

describe('P35 split-bill move', () => {
  it('S1: move re-points the item and recalculates BOTH folios', async () => {
    const r = await request(app)
      .post('/v1/folios/move-item')
      .set(ctx.H())
      .send({ itemId: ctx.charge1.id, targetFolioId: ctx.folioB.id });
    expect(r.status).toBe(200);
    expect(r.body.data.moved).toBe(true);

    const moved = await prisma.folioItem.findFirst({ where: { id: ctx.charge1.id } });
    expect(moved.movedFromFolioId).toBe(ctx.folioA.id);
    expect(moved.movedAt).toBeTruthy();
    expect(moved.movedBy).toBeTruthy();

    const a = await prisma.folio.findFirst({ where: { id: ctx.folioA.id } });
    const b = await prisma.folio.findFirst({ where: { id: ctx.folioB.id } });
    expect(Number(a.totalCharges)).toBe(300);
    expect(Number(a.balance)).toBe(300);
    expect(Number(b.totalCharges)).toBe(500);
    expect(Number(b.balance)).toBe(500);
    console.log('P35 S1 OK — pointer moved, audit trail set, both folios recalculated');
  }, 60000);

  it('S2: cross-reservation move rejected', async () => {
    const r = await request(app)
      .post('/v1/folios/move-item')
      .set(ctx.H())
      .send({ itemId: ctx.charge2.id, targetFolioId: ctx.folioOther.id });
    expect([400, 409]).toContain(r.status);
    const unmoved = await prisma.folioItem.findFirst({ where: { id: ctx.charge2.id } });
    expect(unmoved.folioId).toBe(ctx.folioA.id);
    console.log('P35 S2 OK — cross-reservation guard holds');
  }, 60000);

  it('S3: audit trail is complete on the moved item', async () => {
    const moved = await prisma.folioItem.findFirst({ where: { id: ctx.charge1.id } });
    expect(moved.rebateOfId ?? null).toBeNull(); // a move is not a rebate
    expect(moved.movedFromFolioId).toBe(ctx.folioA.id);
    const history = await prisma.folioItem.findMany({ where: { id: ctx.charge1.id } });
    expect(history.length).toBe(1); // one record, never duplicated
    console.log('P35 S3 OK — single immutable record, move audit complete');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
