/* P37 — 4.1b undo check-out: guarded revert to checked_in; reopens closed
 * folios; blocked once folio items posted after checkout; atomic guard.
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
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'UCO',
      code: ('UCO' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'UCO RT',
      code: 'UCORT' + runId.toUpperCase().slice(-4),
    },
  });
  const room = await prisma.room.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      roomTypeId: rt.id,
      number: 'UCO-1',
      housekeepingStatus: 'ready',
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'UCO', lastName: 'Guest', email: `uco-${runId}@example.com` },
  });
  const mkRes = () =>
    prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber: 'UCO' + Math.random().toString(36).slice(2, 8).toUpperCase(),
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
  for (const r of [ctx.resA, ctx.resB]) {
    await prisma.folio.create({
      data: { tenantId: t, reservationId: r.id, totalCharges: 0, totalPayments: 0, balance: 0 },
    });
    await prisma.reservationStay.create({
      data: { reservationId: r.id, roomId: room.id, date: new Date(), rate: 500 },
    });
  }
  ctx.t = t;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('P37 seeded');
}, 90000);

describe('P37 undo check-out (4.1b)', () => {
  it('S1: undo reverts checked_out → checked_in and reopens the folio', async () => {
    await svc.checkInReservation(ctx.t, ctx.resA.id);
    await svc.checkOutReservation(ctx.t, ctx.resA.id);
    let folio = await prisma.folio.findFirst({ where: { reservationId: ctx.resA.id } });
    expect(folio.status).toBe('closed');

    const r = await request(app)
      .post(`/v1/reservations/${ctx.resA.id}/undo-check-out`)
      .set(ctx.H());
    expect(r.status).toBe(200);
    const res = await prisma.reservation.findFirst({ where: { id: ctx.resA.id } });
    expect(res.status).toBe('checked_in');
    expect(res.checkedOutAt ?? null).toBeNull();
    folio = await prisma.folio.findFirst({ where: { reservationId: ctx.resA.id } });
    expect(folio.status).toBe('open');
    console.log('P37 S1 OK — revert, folio reopened');
  }, 60000);

  it('S2: blocked once folio items posted after checkout', async () => {
    await svc.checkInReservation(ctx.t, ctx.resB.id, undefined, { force: true });
    await svc.checkOutReservation(ctx.t, ctx.resB.id);
    const res = await prisma.reservation.findFirst({ where: { id: ctx.resB.id } });
    const folio = await prisma.folio.findFirst({ where: { reservationId: ctx.resB.id } });
    await prisma.folioItem.create({
      data: {
        folioId: folio.id,
        type: 'payment',
        description: 'Post-checkout settlement',
        amount: -200,
        quantity: 1,
        postedAt: new Date(res.checkedOutAt.getTime() + 60_000),
      },
    });
    const r = await request(app)
      .post(`/v1/reservations/${ctx.resB.id}/undo-check-out`)
      .set(ctx.H());
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('POSTED_SINCE_CHECKOUT');
    const still = await prisma.reservation.findFirst({ where: { id: ctx.resB.id } });
    expect(still.status).toBe('checked_out');
    console.log('P37 S2 OK — post-checkout activity guard holds');
  }, 60000);

  it('S3: double undo / wrong status → 409', async () => {
    const again = await request(app)
      .post(`/v1/reservations/${ctx.resA.id}/undo-check-out`)
      .set(ctx.H());
    expect(again.status).toBe(409);
    console.log('P37 S3 OK — atomic guard');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
