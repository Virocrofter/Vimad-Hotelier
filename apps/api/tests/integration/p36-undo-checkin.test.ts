/* P36 — 4.1b undo check-in: guarded revert to confirmed; blocked once
 * charges were posted during the stay (reverse them first); atomic guard.
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
  svc = await import('../../src/modules/reservations/reservations.service.js');
  ctx.folioSvc = await import('../../src/modules/folios/folios.service.js');
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'UC',
      code: ('UC' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'UC RT',
      code: 'UCRT' + runId.toUpperCase().slice(-4),
    },
  });
  const room = await prisma.room.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      roomTypeId: rt.id,
      number: 'UC-1',
      housekeepingStatus: 'ready',
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'UC', lastName: 'Guest', email: `uc-${runId}@example.com` },
  });
  const mkRes = () =>
    prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber: 'UC' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        status: 'confirmed',
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
      reservationId: ctx.resB.id,
      totalCharges: 0,
      totalPayments: 0,
      balance: 0,
    },
  });
  for (const r of [ctx.resA, ctx.resB]) {
    const stay = await prisma.reservationStay.create({
      data: { reservationId: r.id, roomId: room.id, date: new Date(), rate: 500 },
    });
    r.stayId = stay.id;
  }
  ctx.t = t;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('P36 seeded');
}, 90000);

describe('P36 undo check-in (4.1b)', () => {
  it('S1: undo reverts checked_in → confirmed, clearing check-in stamps', async () => {
    await svc.checkInReservation(ctx.t, ctx.resA.id);
    const r = await request(app).post(`/v1/reservations/${ctx.resA.id}/undo-check-in`).set(ctx.H());
    expect(r.status).toBe(200);
    const res = await prisma.reservation.findFirst({ where: { id: ctx.resA.id } });
    expect(res.status).toBe('confirmed');
    expect(res.checkedInAt ?? null).toBeNull();
    expect(res.checkedInBy ?? null).toBeNull();
    console.log('P36 S1 OK — guarded revert, stamps cleared');
  }, 60000);

  it('S2: blocked once charges were posted during the stay', async () => {
    await svc.checkInReservation(ctx.t, ctx.resB.id);
    await ctx.folioSvc.postCharge(ctx.t, ctx.folioB.id, {
      type: 'service',
      description: 'Late minibar',
      amount: 120,
      quantity: 1,
    });
    const r = await request(app).post(`/v1/reservations/${ctx.resB.id}/undo-check-in`).set(ctx.H());
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CHARGES_POSTED');
    const res = await prisma.reservation.findFirst({ where: { id: ctx.resB.id } });
    expect(res.status).toBe('checked_in');
    console.log('P36 S2 OK — charges-posted guard holds');
  }, 60000);

  it('S3: double undo / wrong status → 409', async () => {
    const again = await request(app)
      .post(`/v1/reservations/${ctx.resA.id}/undo-check-in`)
      .set(ctx.H());
    expect(again.status).toBe(409);
    console.log('P36 S3 OK — atomic guard');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
