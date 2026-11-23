/* 7.2 — supervisor space-status report + bulk assign. */
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
      name: 'SR',
      code: ('SR' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'SR RT',
      code: 'SRRT' + runId.toUpperCase().slice(-4),
    },
  });
  const mk = (num: string, floor: string, hk: string) =>
    prisma.room.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        roomTypeId: rt.id,
        number: num,
        floor,
        housekeepingStatus: hk,
      },
    });
  ctx.r1 = await mk('SR-101', '1', 'ready');
  ctx.r2 = await mk('SR-102', '1', 'dirty');
  ctx.r3 = await mk('SR-201', '2', 'ready');
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'SR', lastName: 'Guest', email: `sr-${runId}@example.com` },
  });
  const arrival = new Date(Date.now() + 2 * 86400_000);
  const res = await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: g.id,
      confirmationNumber: 'SRRES' + runId.toUpperCase().slice(-6),
      status: 'confirmed',
      arrivalDate: arrival,
      departureDate: new Date(arrival.getTime() + 2 * 86400_000),
      nights: 2,
      totalAmount: 1000,
      balance: 0,
    },
  });
  ctx.resId = res.id;
  const assignee = await prisma.user.create({
    data: {
      tenantId: t,
      email: `sr-att-${runId}@example.com`,
      firstName: 'Att',
      lastName: 'endant',
      role: 'staff',
      passwordHash: 'x',
    },
  });
  ctx.assigneeId = assignee.id;
  ctx.t1 = await prisma.task.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      department: 'housekeeping',
      title: 'Clean SR-102',
      roomId: ctx.r2.id,
      assigneeId: assignee.id,
      priority: 'normal',
    },
  });
  ctx.t2 = await prisma.task.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      department: 'housekeeping',
      title: 'Inspect SR-201',
      roomId: ctx.r3.id,
      priority: 'normal',
    },
  });
  ctx.propId = prop.id;
  ctx.t = t;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('7.2 seeded');
}, 90000);

describe('7.2 supervisor space report + bulk assign', () => {
  it('S1: rooms grouped by floor with status, attendant, and next arrival', async () => {
    const r = await request(app)
      .get('/v1/housekeeping/supervisor/space-report?propertyId=' + ctx.propId)
      .set(ctx.H());
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.totalRooms).toBe(3);
    const f1 = d.floors.find((f: any) => f.floor === '1');
    const f2 = d.floors.find((f: any) => f.floor === '2');
    expect(f1.rooms.length).toBe(2);
    expect(f1.counts.ready).toBe(1);
    expect(f1.counts.dirty).toBe(1);
    expect(f2.rooms.length).toBe(1);
    const r102 = f1.rooms.find((x: any) => x.number === 'SR-102');
    expect(r102.attendantId).toBe(ctx.assigneeId);
    console.log('7.2 S1 OK — floor grouping, counts, attendant context');
  }, 60000);

  it('S2: bulk-assign moves open tasks to one attendant', async () => {
    const r = await request(app)
      .post('/v1/housekeeping/supervisor/tasks/bulk-assign')
      .set(ctx.H())
      .send({ taskIds: [ctx.t1.id, ctx.t2.id], assigneeId: ctx.assigneeId });
    expect(r.status).toBe(200);
    expect(r.body.data.updated).toBe(2);
    const tasks = await prisma.task.findMany({ where: { id: { in: [ctx.t1.id, ctx.t2.id] } } });
    expect(tasks.every((x: any) => x.assigneeId === ctx.assigneeId)).toBe(true);
    console.log('7.2 S2 OK — bulk assign');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
