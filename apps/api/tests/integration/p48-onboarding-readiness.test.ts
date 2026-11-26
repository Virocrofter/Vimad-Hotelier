/* P48 — onboarding readiness gate: five data-verified dimensions. Assertions
 * are FLAG-based, not count-based: the baseline-done step varies by
 * environment (dev .env may carry platform Paystack keys → payments done at
 * baseline), so we only ever assert that seeding flips each dimension true
 * and that payments self-reports consistently.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  ctx.other = await mod.registerTestAgent(app);
  ctx.otherH = () => ({ Authorization: 'Bearer ' + ctx.other.token });
  console.log('P48 seeded');
}, 90000);

const step = (b: any, key: string) => (b?.data ?? b)?.steps.find((s: any) => s.key === key);
const keys = (b: any) => (b?.data ?? b)?.steps.map((s: any) => s.key).sort();

describe('P48 onboarding readiness', () => {
  it('S1: five dimensions present; each seeded dimension flips to done', async () => {
    const fresh = await request(app).get('/v1/readiness').set(ctx.H());
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.steps.length).toBe(5);
    expect(keys(fresh.body)).toEqual(
      ['channel_mapping', 'payments', 'property_basics', 'rates', 'spaces'].sort()
    );

    const prop = await prisma.property.create({
      data: {
        tenantId: ctx.tenantId,
        name: 'RD',
        code: ('RD' + runId)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(-12),
      },
    });
    ctx.propId = prop.id;
    let r = (await request(app).get('/v1/readiness').set(ctx.H())).body.data;
    expect(step(r, 'property_basics').done).toBe(true);

    const rt = await prisma.roomType.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: prop.id,
        name: 'RD RT',
        code: 'RDRT' + runId.toUpperCase().slice(-4),
      },
    });
    await prisma.room.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: prop.id,
        roomTypeId: rt.id,
        number: 'RD-1',
      },
    });
    r = (await request(app).get('/v1/readiness').set(ctx.H())).body.data;
    expect(step(r, 'spaces').done).toBe(true);

    const rp = await prisma.ratePlan.create({
      data: {
        tenant: { connect: { id: ctx.tenantId } },
        property: { connect: { id: prop.id } },
        roomType: { connect: { id: rt.id } },
        name: 'RD BAR',
        code: 'RDBAR' + runId.toUpperCase().slice(-4),
        baseRate: 1200,
      },
    });
    expect(rp.id).toBeTruthy();
    r = (await request(app).get('/v1/readiness').set(ctx.H())).body.data;
    expect(step(r, 'rates').done).toBe(true);

    await prisma.channelConnection.create({
      data: {
        tenant: { connect: { id: ctx.tenantId } },
        property: { connect: { id: prop.id } },
        provider: 'channex',
        hotelId: 'HOTEL-' + runId,
        apiKey: 'test-key-' + runId,
        status: 'active',
      },
    });
    r = (await request(app).get('/v1/readiness').set(ctx.H())).body.data;
    expect(step(r, 'channel_mapping').done).toBe(true);

    const pay = step(r, 'payments');
    expect(pay.configured).toBe(
      Boolean(process.env.PAYSTACK_SECRET_KEY ?? process.env.PAYSTACK_SECRET)
    );
    expect(pay.done).toBe(pay.configured || pay.tested);
    console.log('P48 S1 OK — dimensions flip on real data');
  }, 60000);

  it('S2: a recorded payment marks payments tested; all five done → ready', async () => {
    const guest = await prisma.guest.create({
      data: { tenantId: ctx.tenantId, firstName: 'RD', lastName: 'Pay' },
    });
    const res = await prisma.reservation.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propId,
        guestId: guest.id,
        confirmationNumber: 'RD' + runId.toUpperCase().slice(-6),
        status: 'confirmed',
        arrivalDate: new Date(),
        departureDate: new Date(Date.now() + 86400_000),
        nights: 1,
        totalAmount: 100,
        balance: 100,
      },
    });
    await prisma.payment.create({
      data: {
        tenantId: ctx.tenantId,
        reservationId: res.id,
        reference: 'RD-PAY-' + runId,
        amountMinor: 10000,
        currency: 'ZAR',
        type: 'deposit',
        status: 'success',
      },
    });
    const r = (await request(app).get('/v1/readiness').set(ctx.H())).body.data;
    expect(step(r, 'payments').done).toBe(true);
    expect(step(r, 'payments').tested).toBe(true);
    for (const k of ['property_basics', 'spaces', 'rates', 'channel_mapping']) {
      expect(step(r, k).done).toBe(true);
    }
    expect(r.ready).toBe(true);
    expect(r.percent).toBe(100);
    console.log('P48 S2 OK — tested payment completes the gate');
  }, 60000);

  it('S3: readiness is tenant-scoped; unauthenticated denied', async () => {
    const foreign = await request(app).get('/v1/readiness').set(ctx.otherH());
    expect(foreign.status).toBe(200);
    expect(step(foreign.body, 'property_basics').done).toBe(false); // their tenant, no property seeded by us
    expect(step(foreign.body, 'spaces').done).toBe(false);
    expect(step(foreign.body, 'rates').done).toBe(false);
    expect(step(foreign.body, 'channel_mapping').done).toBe(false);

    const anon = await request(app).get('/v1/readiness');
    expect(anon.status).toBe(401);
    console.log('P48 S3 OK — scoping + auth');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
