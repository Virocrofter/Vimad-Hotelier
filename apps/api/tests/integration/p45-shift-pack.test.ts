/* P45 — load-shedding shift pack: one call returns today's arrivals,
 * departures, in-house roll call and room states, with a pull timestamp.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

const d = (offset: number) => {
  const x = new Date();
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() + offset);
  return x;
};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });

  const prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'SP',
      code: ('SP' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.propId = prop.id;
  const rt = await prisma.roomType.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: prop.id,
      name: 'SP RT',
      code: 'SPRT' + runId.toUpperCase().slice(-4),
    },
  });
  const mkRoom = (num: string, hk: string) =>
    prisma.room.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: prop.id,
        roomTypeId: rt.id,
        number: num,
        housekeepingStatus: hk,
      },
    });
  ctx.roomA = await mkRoom('SP-1', 'ready');
  await mkRoom('SP-2', 'dirty');

  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'SP', lastName: 'Guest' },
  });
  const mkRes = (over: Record<string, unknown>) =>
    prisma.reservation.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: prop.id,
        guestId: guest.id,
        confirmationNumber: 'SP' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        status: 'confirmed',
        arrivalDate: d(0),
        departureDate: d(1),
        nights: 1,
        totalAmount: 700,
        balance: 700,
        ...over,
      },
    });
  ctx.arr = await mkRes({});
  ctx.dep = await mkRes({ arrivalDate: d(-2), departureDate: d(0) });
  ctx.inHouse = await mkRes({ status: 'checked_in' });
  ctx.otherAgent = await mod.registerTestAgent(app);
  ctx.other = () => ({ Authorization: 'Bearer ' + ctx.otherAgent.token });
  console.log('P45 seeded');
}, 90000);

describe('P45 shift pack', () => {
  it('S1: one call returns arrivals/departures/in-house/rooms with a pull stamp', async () => {
    const r = await request(app).get(`/v1/shift-pack/today?propertyId=${ctx.propId}`).set(ctx.H());
    expect(r.status).toBe(200);
    const data = r.body.data;
    expect(data.generatedAt).toBeTruthy();
    expect(data.businessDate).toBeTruthy();
    expect(data.arrivals.map((x: any) => x.confirmationNumber)).toContain(
      ctx.arr.confirmationNumber
    );
    expect(data.departures.map((x: any) => x.confirmationNumber)).toContain(
      ctx.dep.confirmationNumber
    );
    expect(data.inHouse.map((x: any) => x.confirmationNumber)).toContain(
      ctx.inHouse.confirmationNumber
    );
    const roomNumbers = data.rooms.map((x: any) => x.number);
    expect(roomNumbers).toContain('SP-1');
    expect(roomNumbers).toContain('SP-2');
    const sp1 = data.rooms.find((x: any) => x.number === 'SP-1');
    expect(sp1.housekeepingStatus).toBe('ready');
    console.log('P45 S1 OK — the four buckets in one stamped call');
  }, 60000);

  it('S2: scoping + missing property', async () => {
    const foreign = await request(app)
      .get(`/v1/shift-pack/today?propertyId=${ctx.propId}`)
      .set(ctx.other());
    expect(foreign.status).toBe(404);
    const missing = await request(app).get('/v1/shift-pack/today').set(ctx.H());
    expect(missing.status).toBe(400);
    console.log('P45 S2 OK — tenant scoping + validation');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
