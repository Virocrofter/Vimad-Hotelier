/* 7.3 — arrival urgency: unserviced rooms with upcoming arrivals, arrival-sorted. */
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
      name: 'AU',
      code: ('AU' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'AU RT',
      code: 'AURT' + runId.toUpperCase().slice(-4),
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'AU', lastName: 'Guest', email: `au-${runId}@example.com` },
  });
  const mk = (num: string, hk: string) =>
    prisma.room.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        roomTypeId: rt.id,
        number: num,
        floor: '1',
        housekeepingStatus: hk,
      },
    });
  const rDirtySoon = await mk('AU-101', 'dirty'); // arrival tomorrow -> urgent
  const rDirtyLater = await mk('AU-102', 'dirty'); // arrival +4d -> urgent, later
  const rReady = await mk('AU-103', 'ready'); // arrival tomorrow but serviced -> excluded
  const rDirtyNoArrival = await mk('AU-104', 'dirty'); // no arrival -> excluded
  const mkRes = async (roomId: string, arrivalOffsetDays: number) => {
    const arrival = new Date(Date.now() + arrivalOffsetDays * 86400_000);
    const res = await prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber: 'AU' + roomId.slice(-3) + runId.toUpperCase().slice(-5),
        status: 'confirmed',
        arrivalDate: arrival,
        departureDate: new Date(arrival.getTime() + 2 * 86400_000),
        nights: 2,
        totalAmount: 1000,
        balance: 0,
      },
    });
    await prisma.reservationStay.create({
      data: { reservationId: res.id, roomId, date: arrival, rate: 500 },
    });
  };
  await mkRes(rDirtySoon.id, 1);
  await mkRes(rDirtyLater.id, 4);
  await mkRes(rReady.id, 1);
  ctx.propId = prop.id;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('7.3 seeded');
}, 90000);

describe('7.3 arrival urgency', () => {
  it('S1: urgent = unserviced rooms with arrivals, sorted by arrival date', async () => {
    const r = await request(app)
      .get('/v1/housekeeping/supervisor/space-report?propertyId=' + ctx.propId)
      .set(ctx.H());
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.urgentCount).toBe(2);
    expect(d.urgent.map((x: any) => x.number)).toEqual(['AU-101', 'AU-102']); // arrival-sorted
    expect(d.urgent[0].nextArrival < d.urgent[1].nextArrival).toBe(true);
    console.log('7.3 S1 OK — urgency sorted, exclusions exact');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
