/* 7.8 — Lost & Found ledger (P32): item registry linked to the departed
 * guest's reservation; found → claimed → returned | disposed lifecycle.
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
      name: 'LF',
      code: ('LF' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'LF RT',
      code: 'LFRT' + runId.toUpperCase().slice(-4),
    },
  });
  const room = await prisma.room.create({
    data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: 'LF-101', floor: '1' },
  });
  const g = await prisma.guest.create({
    data: {
      tenantId: t,
      firstName: 'Departed',
      lastName: 'Guest',
      email: `lf-${runId}@example.com`,
    },
  });
  const y = new Date(Date.now() - 86400_000);
  const res = await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: g.id,
      confirmationNumber: 'LFRES' + runId.toUpperCase().slice(-6),
      status: 'checked_out',
      arrivalDate: new Date(y.getTime() - 86400_000),
      departureDate: y,
      nights: 1,
      totalAmount: 800,
      balance: 0,
    },
  });
  ctx.t = t;
  ctx.propId = prop.id;
  ctx.roomId = room.id;
  ctx.guestId = g.id;
  ctx.resId = res.id;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('7.8 seeded');
}, 90000);

describe('7.8 lost & found ledger', () => {
  it('S1: register an item found in a departed guest room, linked to that reservation', async () => {
    const r = await request(app)
      .post('/v1/housekeeping/supervisor/lost-found')
      .set(ctx.H())
      .send({
        propertyId: ctx.propId,
        description: 'Silver watch under the mattress',
        category: 'valuables',
        foundRoomId: ctx.roomId,
        guestId: ctx.guestId,
        reservationId: ctx.resId,
        photoUrls: ['https://example.com/watch.jpg'],
      });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('found');
    ctx.itemId = r.body.data.id;

    const list = await request(app)
      .get('/v1/housekeeping/supervisor/lost-found?propertyId=' + ctx.propId)
      .set(ctx.H());
    expect(list.status).toBe(200);
    const item = list.body.data.items.find((x: any) => x.id === ctx.itemId);
    expect(item.guest.lastName).toBe('Guest');
    expect(item.foundRoom.number).toBe('LF-101');
    expect(item.reservation.confirmationNumber).toContain('LFRES');
    console.log('7.8 S1 OK — item linked to departed guest + reservation');
  }, 60000);

  it('S2: found → claimed → returned lifecycle with timestamps', async () => {
    const claim = await request(app)
      .patch('/v1/housekeeping/supervisor/lost-found/' + ctx.itemId)
      .set(ctx.H())
      .send({ status: 'claimed' });
    expect(claim.status).toBe(200);
    expect(claim.body.data.status).toBe('claimed');
    expect(claim.body.data.claimedAt).toBeTruthy();

    const ret = await request(app)
      .patch('/v1/housekeeping/supervisor/lost-found/' + ctx.itemId)
      .set(ctx.H())
      .send({ status: 'returned', notes: 'Collected at front desk' });
    expect(ret.status).toBe(200);
    expect(ret.body.data.status).toBe('returned');
    expect(ret.body.data.returnedAt).toBeTruthy();

    const again = await request(app)
      .patch('/v1/housekeeping/supervisor/lost-found/' + ctx.itemId)
      .set(ctx.H())
      .send({ status: 'claimed' });
    expect(again.status).toBe(409);
    console.log('7.8 S2 OK — lifecycle + terminal guard');
  }, 60000);

  it('S3: found → disposed legal; status filter works', async () => {
    const c = await request(app)
      .post('/v1/housekeeping/supervisor/lost-found')
      .set(ctx.H())
      .send({ propertyId: ctx.propId, description: 'Old umbrella', category: 'general' });
    expect(c.status).toBe(201);
    const d = await request(app)
      .patch('/v1/housekeeping/supervisor/lost-found/' + c.body.data.id)
      .set(ctx.H())
      .send({ status: 'disposed' });
    expect(d.status).toBe(200);
    expect(d.body.data.disposedAt).toBeTruthy();

    const foundOnly = await request(app)
      .get('/v1/housekeeping/supervisor/lost-found?propertyId=' + ctx.propId + '&status=found')
      .set(ctx.H());
    expect(foundOnly.body.data.items.every((x: any) => x.status === 'found')).toBe(true);
    console.log('7.8 S3 OK — dispose path + filter');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
