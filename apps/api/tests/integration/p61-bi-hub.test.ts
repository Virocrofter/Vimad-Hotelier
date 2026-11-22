/* Phase 6.1 — BI hub: six curated families over one scoped query surface. */
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
      name: 'BI',
      code: ('BI' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'BI RT',
      code: 'BIRT' + runId.toUpperCase().slice(-4),
    },
  });
  await prisma.room.create({
    data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: 'BI-1' },
  });
  await prisma.room.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      roomTypeId: rt.id,
      number: 'BI-2',
      serviceStatus: 'oos',
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'BI', lastName: 'Guest', email: `bi-${runId}@example.com` },
  });
  const today = new Date().toISOString().slice(0, 10);
  await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: g.id,
      confirmationNumber: 'BICHECKIN' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(today),
      departureDate: new Date(Date.now() + 2 * 86400_000),
      nights: 2,
      totalAmount: 2000,
      balance: 0,
    },
  });
  await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: g.id,
      confirmationNumber: 'BIARRIVE' + runId.toUpperCase().slice(-6),
      status: 'confirmed',
      arrivalDate: new Date(Date.now() + 4 * 86400_000),
      departureDate: new Date(Date.now() + 6 * 86400_000),
      nights: 2,
      totalAmount: 1800,
      balance: 0,
    },
  });
  await prisma.payment.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      reservationId: null,
      guestId: g.id,
      reference: 'BIPAY-' + runId,
      amountMinor: 50000,
      currency: 'ZAR',
      type: 'deposit',
      status: 'success',
      postedToFolio: false,
      channel: 'card',
    },
  });
  ctx.t = t;
  ctx.propId = prop.id;
  console.log('6.1 seeded');
}, 90000);

describe('Phase 6.1 BI hub', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });

  it('S1: /v1/bi/families returns all six curated families, scoped', async () => {
    const r = await request(app)
      .get('/v1/bi/families?propertyId=' + ctx.propId)
      .set(H());
    expect(r.status).toBe(200);
    const d = r.body.data;
    for (const k of [
      'dailySummary',
      'occupancyRevenue',
      'paymentsMix',
      'arAging',
      'blockedRooms',
      'pickup',
    ]) {
      expect(d[k], k).toBeTruthy();
    }
    expect(d.dailySummary.stayovers).toBe(1);
    expect(d.dailySummary.arrivalsToday).toBe(1);
    expect(d.occupancyRevenue.rooms).toBe(2);
    expect(d.blockedRooms.find((b: any) => b.serviceStatus === 'oos')?.count).toBe(1);
    expect(d.paymentsMix.find((p: any) => p.channel === 'card')?.totalMinor).toBe(50000);
    expect(d.pickup.next7dArrivals).toBe(1);
    console.log('6.1 S1 OK — six families, property-scoped');
  }, 60000);

  it('S2: missing propertyId rejected; other property yields empty families', async () => {
    const noProp = await request(app).get('/v1/bi/families').set(H());
    expect(noProp.status).toBe(400);
    const other = await prisma.property.create({
      data: { tenantId: ctx.t, name: 'BI2', code: ('BI2' + runId).toUpperCase().slice(-12) },
    });
    const r = await request(app)
      .get('/v1/bi/families?propertyId=' + other.id)
      .set(H());
    expect(r.status).toBe(200);
    expect(r.body.data.dailySummary.stayovers).toBe(0);
    console.log('6.1 S2 OK — scoping enforced');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
