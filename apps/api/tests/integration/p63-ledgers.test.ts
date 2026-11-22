/* 6.3 — ledgers + the tie-out. balanced === Σfolio balances == charges − payments.
 * S1: charges posted through the chokepoint tie exactly; balanced true.
 * S2: a corrupted folio balance breaks the tie; balanced false.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'LG',
      code: ('LG' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'LG RT',
      code: 'LGRT' + runId.toUpperCase().slice(-4),
    },
  });
  await prisma.room.create({
    data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: 'LG-1' },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'LG', lastName: 'Guest', email: `lg-${runId}@example.com` },
  });
  const res = await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: g.id,
      confirmationNumber: 'LGRES' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 2 * 86400_000),
      nights: 2,
      totalAmount: 0,
      balance: 0,
    },
  });
  const folio = await prisma.folio.create({
    data: { tenantId: t, reservationId: res.id, status: 'open' },
  });
  ctx.t = t;
  ctx.propId = prop.id;
  ctx.folioId = folio.id;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('6.3 seeded');
}, 90000);

describe('6.3 ledgers', () => {
  it('S1: chokepoint-posted charges tie; balanced true', async () => {
    await request(app)
      .post('/v1/folios/charge-to-room')
      .set(ctx.H())
      .send({
        reservationId: (await prisma.folio.findFirst({ where: { id: ctx.folioId } }))!
          .reservationId,
        description: 'Room charge',
        amount: 1000,
      });
    await request(app)
      .post('/v1/folios/charge-to-room')
      .set(ctx.H())
      .send({
        reservationId: (await prisma.folio.findFirst({ where: { id: ctx.folioId } }))!
          .reservationId,
        description: 'Minibar',
        amount: 250,
      });

    const r = await request(app)
      .get('/v1/bi/ledgers?propertyId=' + ctx.propId)
      .set(ctx.H());
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.trialBalance.charges).toBe(1250);
    expect(d.trialBalance.payments).toBe(0);
    expect(d.trialBalance.balanceTotal).toBe(1250);
    expect(d.trialBalance.difference).toBe(0);
    expect(d.balanced).toBe(true);
    expect(d.guest.length).toBe(1);
    expect(d.guest[0].balance).toBe(1250);
    console.log('6.3 S1 OK — books tie, balanced pill earned');
  }, 60000);

  it('S2: corrupted balance breaks the tie; balanced false', async () => {
    await prisma.folio.update({ where: { id: ctx.folioId }, data: { balance: 999 } });
    const r = await request(app)
      .get('/v1/bi/ledgers?propertyId=' + ctx.propId)
      .set(ctx.H());
    expect(r.body.data.balanced).toBe(false);
    expect(r.body.data.trialBalance.difference).not.toBe(0);
    console.log('6.3 S2 OK — corruption detected');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
