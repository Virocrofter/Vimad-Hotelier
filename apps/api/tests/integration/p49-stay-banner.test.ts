/* P49 — contextual stay banner: state machine over the live reservation
 * (pre_arrival → arrived_dirty → in_house → departure), CTAs, room via the
 * P20 bridge, balance from the folio, offers from the M1′ catalog, token
 * discipline (portal scope only).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

const SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-min-32-chars';
const mint = (reservationId: string, tenantId: string, scope = 'guest-portal') =>
  jwt.sign({ reservationId, tenantId, scope }, SECRET);

const d = (offset: number) => {
  const x = new Date();
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() + offset);
  return x;
};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'SB',
      code: ('SB' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'SB', lastName: 'Guest' },
  });
  ctx.rt = await prisma.roomType.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'SB RT',
      code: 'SBRT' + runId.toUpperCase().slice(-4),
    },
  });
  ctx.room = await prisma.room.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      roomTypeId: ctx.rt.id,
      number: 'SB-9',
      housekeepingStatus: 'dirty',
    },
  });
  await prisma.upsellProduct.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'Early check-in',
      price: 250,
      status: 'active',
    },
  });

  const mkRes = (over: Record<string, unknown>) =>
    prisma.reservation.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: ctx.prop.id,
        guestId: ctx.guest.id,
        roomTypeId: ctx.rt.id,
        confirmationNumber: 'SB' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        status: 'confirmed',
        arrivalDate: d(0),
        departureDate: d(2),
        nights: 2,
        totalAmount: 1200,
        balance: 1200,
        ...over,
      },
    });
  ctx.resPre = await mkRes({ arrivalDate: d(3), departureDate: d(5), nights: 2 });
  ctx.resStay = await mkRes({ status: 'checked_in' });
  ctx.resDepart = await mkRes({
    status: 'checked_in',
    departureDate: d(0),
    arrivalDate: d(-2),
    nights: 2,
  });
  await (prisma as any).reservationRoom.create({
    data: {
      tenant: { connect: { id: agent.tenantId } },
      property: { connect: { id: ctx.prop.id } },
      reservation: { connect: { id: ctx.resStay.id } },
      room: { connect: { id: ctx.room.id } },
    },
  });
  ctx.folio = await prisma.folio.create({
    data: {
      tenantId: agent.tenantId,
      reservationId: ctx.resDepart.id,
      totalCharges: 500,
      totalPayments: 0,
      balance: 500,
    },
  });
  console.log('P49 seeded');
}, 90000);

describe('P49 stay banner', () => {
  it('S1: pre_arrival shows check-in CTA; offers ride from the catalog', async () => {
    const r = await request(app).get(
      `/v1/guest-portal/banner/${mint(ctx.resPre.id, ctx.tenantId)}`
    );
    expect(r.status).toBe(200);
    expect(r.body.data.state).toBe('pre_arrival');
    expect(r.body.data.cta.action).toBe('start_checkin');
    expect(r.body.data.offers.length).toBeGreaterThanOrEqual(1);
    expect(r.body.data.offers[0].name).toBe('Early check-in');
    console.log('P49 S1 OK — pre-arrival + offers');
  }, 60000);

  it('S2: checked_in + dirty room → arrived_dirty; room ready → in_house', async () => {
    const dirty = await request(app).get(
      `/v1/guest-portal/banner/${mint(ctx.resStay.id, ctx.tenantId)}`
    );
    expect(dirty.body.data.state).toBe('arrived_dirty');
    expect(dirty.body.data.roomNumber).toBe('SB-9');
    expect(dirty.body.data.roomReady).toBe(false);
    expect(dirty.body.data.cta.action).toBe('wait');

    await prisma.room.update({ where: { id: ctx.room.id }, data: { housekeepingStatus: 'ready' } });
    const ready = await request(app).get(
      `/v1/guest-portal/banner/${mint(ctx.resStay.id, ctx.tenantId)}`
    );
    expect(ready.body.data.state).toBe('in_house');
    expect(ready.body.data.roomReady).toBe(true);
    expect(ready.body.data.cta.action).toBe('digital_key');
    expect(ready.body.data.headline).toContain('SB-9');
    console.log('P49 S2 OK — dirty→prepared, ready→key');
  }, 60000);

  it('S3: departure shows balance CTA; token discipline enforced', async () => {
    const r = await request(app).get(
      `/v1/guest-portal/banner/${mint(ctx.resDepart.id, ctx.tenantId)}`
    );
    expect(r.body.data.state).toBe('departure');
    expect(r.body.data.balance).toBe(500);
    expect(r.body.data.cta.action).toBe('express_checkout');
    expect(r.body.data.cta.label).toContain('500.00');

    const bad = await request(app).get('/v1/guest-portal/banner/not-a-token');
    expect(bad.status).toBe(401);

    const wrongScope = await request(app).get(
      `/v1/guest-portal/banner/${mint(ctx.resPre.id, ctx.tenantId, 'staff')}`
    );
    expect(wrongScope.status).toBe(401);
    console.log('P49 S3 OK — departure + token discipline');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
