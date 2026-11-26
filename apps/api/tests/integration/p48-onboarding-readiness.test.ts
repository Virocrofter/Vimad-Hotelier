/* P48 — onboarding readiness gate: five data-verified dimensions. The test
 * helper seeds a property per tenant, so baseline doneCount is 1 — all
 * assertions are baseline-relative.
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

const step = (body: any, key: string) => body.data.steps.find((s: any) => s.key === key);

describe('P48 onboarding readiness', () => {
  it('S1: baseline is helper-seeded; each seeded dimension flips to done', async () => {
    const fresh = await request(app).get('/v1/readiness').set(ctx.H());
    expect(fresh.status).toBe(200);
    ctx.base = fresh.body.data.doneCount; // helper seeds a property → 1
    expect(step(fresh.body, 'property_basics').done).toBe(true);
    expect(step(fresh.body, 'spaces').done).toBe(false);
    expect(step(fresh.body, 'rates').done).toBe(false);
    expect(step(fresh.body, 'payments').done).toBe(false);
    expect(step(fresh.body, 'channel_mapping').done).toBe(false);

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
    expect(r.doneCount).toBe(ctx.base);

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
    expect(r.doneCount).toBe(ctx.base + 1);

    const rp = await prisma.ratePlan.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: prop.id,
        name: 'RD BAR',
        code: 'RDBAR' + runId.toUpperCase().slice(-4),
      },
    });
    expect(rp.id).toBeTruthy();
    r = (await request(app).get('/v1/readiness').set(ctx.H())).body.data;
    expect(step(r, 'rates').done).toBe(true);
    expect(r.doneCount).toBe(ctx.base + 2);

    await prisma.channelConnection.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: prop.id,
        provider: 'channex',
        status: 'active',
      },
    });
    r = (await request(app).get('/v1/readiness').set(ctx.H())).body.data;
    expect(step(r, 'channel_mapping').done).toBe(true);
    expect(r.doneCount).toBe(ctx.base + 3);

    const pay = step(r, 'payments');
    expect(pay.configured).toBe(
      Boolean(process.env.PAYSTACK_SECRET_KEY ?? process.env.PAYSTACK_SECRET)
    );
    expect(pay.done).toBe(pay.configured || pay.tested);
    console.log('P48 S1 OK — dimensions flip on real data');
  }, 60000);

  it('S2: a recorded payment makes payments done even without platform keys', async () => {
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
    expect(r.ready).toBe(true);
    expect(r.percent).toBe(100);
    console.log('P48 S2 OK — tested payment completes the gate');
  }, 60000);

  it('S3: readiness is tenant-scoped; unauthenticated denied', async () => {
    const foreign = await request(app).get('/v1/readiness').set(ctx.otherH());
    expect(foreign.body.data.doneCount).toBe(ctx.base); // same helper seeding, their own tenant

    const anon = await request(app).get('/v1/readiness');
    expect(anon.status).toBe(401);
    console.log('P48 S3 OK — scoping + auth');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
