/* P10-followup — TZ-stable @db.Date comparisons in the four calendar-date
 * rule providers: arrival-not-inspected-by-12, dnd-decision-16,
 * unassigned-room-16, deposit-t3-payment-request.
 * Seeded reservations at local noon (date part is what the column stores);
 * only the exact calendar-day matches may generate tasks.
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
  svc = await import('../../src/modules/tasks/tasks.service.js');
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'TZ',
      code: ('TZ' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'TZ RT',
      code: 'TZRT' + runId.toUpperCase().slice(-4),
    },
  });
  const mkRoom = (num: string, hk: string) =>
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
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'TZ', lastName: 'Guest', email: `tz-${runId}@example.com` },
  });
  const gDnd = await prisma.guest.create({
    data: {
      tenantId: t,
      firstName: 'DND',
      lastName: 'Guest',
      email: `tzd-${runId}@example.com`,
      doNotDisturb: true,
    },
  });
  const mkRes = (over: Record<string, unknown>) =>
    prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber: 'TZ' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        status: 'confirmed',
        arrivalDate: d(0),
        departureDate: d(2),
        nights: 2,
        totalAmount: 1000,
        balance: 0,
        ...over,
      } as any,
    });
  const rIn = await mkRes({ status: 'checked_in' });
  const roomA = await mkRoom('TZ-101', 'dirty');
  await prisma.reservationStay.create({
    data: { reservationId: rIn.id, roomId: roomA.id, date: d(0), rate: 500 },
  });
  ctx.rIn = rIn;
  const rY = await mkRes({ status: 'checked_in', arrivalDate: d(-1), departureDate: d(1) });
  const roomB = await mkRoom('TZ-102', 'dirty');
  await prisma.reservationStay.create({
    data: { reservationId: rY.id, roomId: roomB.id, date: d(-1), rate: 500 },
  });
  const rTmr = await mkRes({ status: 'checked_in', arrivalDate: d(1), departureDate: d(3) });
  const roomC = await mkRoom('TZ-103', 'dirty');
  await prisma.reservationStay.create({
    data: { reservationId: rTmr.id, roomId: roomC.id, date: d(1), rate: 500 },
  });
  const rDnd = await mkRes({
    status: 'checked_in',
    arrivalDate: d(-2),
    departureDate: d(2),
    guestId: gDnd.id,
  });
  const roomD = await mkRoom('TZ-104', 'ready');
  await prisma.reservationStay.create({
    data: { reservationId: rDnd.id, roomId: roomD.id, date: d(-2), rate: 500 },
  });
  ctx.rDnd = rDnd;
  ctx.rUna = await mkRes({}); // confirmed, arrival today, NO stay
  ctx.rDep = await mkRes({ arrivalDate: d(3), departureDate: d(5), balance: 500 });
  ctx.t = t;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  const rules: Record<string, string> = {};
  for (const [key, extra] of [
    ['arrival-not-inspected-by-12', { config: { hour: 0 } }],
    ['dnd-decision-16', { config: { hour: 0 } }],
    ['unassigned-room-16', { config: { hour: 0 } }],
    ['deposit-t3-payment-request', {}],
  ] as const) {
    const r = await request(app)
      .post('/v1/tasks/rules')
      .set(ctx.H())
      .send({
        key,
        name: key + ' ' + runId,
        department: 'housekeeping',
        trigger: { type: 'schedule', everyMinutes: 60 },
        action: {
          title: `TZ: ${key} — {{guestName}}`,
          department: 'housekeeping',
          priority: 'normal',
        },
        ...extra,
      });
    expect(r.status, key).toBe(201);
    rules[key] = r.body.data.id;
  }
  ctx.rules = rules;
  console.log('P10-fu seeded');
}, 90000);

describe('P10 follow-up — TZ-stable date rules', () => {
  it('S1: arrival-not-inspected flags only arrivals of THIS calendar day', async () => {
    const created = await svc.evaluateRule(ctx.rules['arrival-not-inspected-by-12']);
    expect(created).toBe(1);
    const task = await prisma.task.findFirst({
      where: { ruleId: ctx.rules['arrival-not-inspected-by-12'] },
    });
    expect(task.reservationId).toBe(ctx.rIn.id);
    console.log('S1 OK — exact-day boundary, yesterday/tomorrow excluded');
  }, 60000);

  it('S2: dnd-decision flags the in-house DND guest (UTC margins)', async () => {
    const created = await svc.evaluateRule(ctx.rules['dnd-decision-16']);
    expect(created).toBe(1);
    const task = await prisma.task.findFirst({ where: { ruleId: ctx.rules['dnd-decision-16'] } });
    expect(task.reservationId).toBe(ctx.rDnd.id);
    console.log('S2 OK — DND in-house guest flagged');
  }, 60000);

  it('S3: unassigned-room-16 (today, no stay) + deposit-t3 (today+3, balance>0)', async () => {
    const c1 = await svc.evaluateRule(ctx.rules['unassigned-room-16']);
    expect(c1).toBe(1);
    const t1 = await prisma.task.findFirst({ where: { ruleId: ctx.rules['unassigned-room-16'] } });
    expect(t1.reservationId).toBe(ctx.rUna.id);

    const c2 = await svc.evaluateRule(ctx.rules['deposit-t3-payment-request']);
    expect(c2).toBe(1);
    const t2 = await prisma.task.findFirst({
      where: { ruleId: ctx.rules['deposit-t3-payment-request'] },
    });
    expect(t2.reservationId).toBe(ctx.rDep.id);
    console.log('S3 OK — both calendar-day rules exact');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
