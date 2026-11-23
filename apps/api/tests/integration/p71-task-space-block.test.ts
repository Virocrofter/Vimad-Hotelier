/* 7.1 — task space-blocking: a CRITICAL ticket marked blocksSpaceStatus flips
 * its room OOO with a reason; the room clears on resolve only when no other
 * open blocking ticket holds it.
 * S1: API create passes blocksSpaceStatus through and the room flips OOO.
 * S2: completing the ticket clears the room.
 * S3: a second blocking ticket holds the room until IT resolves too.
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
  svc = await import('../../src/modules/tasks/tasks.service.js');
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'TB',
      code: ('TB' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'TB RT',
      code: 'TBRT' + runId.toUpperCase().slice(-4),
    },
  });
  const room = await prisma.room.create({
    data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: 'TB-1' },
  });
  ctx.t = t;
  ctx.propId = prop.id;
  ctx.roomId = room.id;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('7.1 seeded');
}, 90000);

const createBlocking = (title: string) =>
  request(app).post('/v1/tasks').set(ctx.H()).send({
    propertyId: ctx.propId,
    department: 'maintenance',
    title,
    priority: 'urgent',
    roomId: ctx.roomId,
    blocksSpaceStatus: true,
  });

describe('7.1 task space-blocking', () => {
  it('S1: API create passes blocksSpaceStatus through; room flips OOO with reason', async () => {
    const r = await createBlocking('Water leak — urgent');
    expect(r.status).toBe(201);
    expect(r.body.data.blocksSpaceStatus).toBe(true);
    ctx.taskId = r.body.data.id;
    const room = await prisma.room.findFirst({ where: { id: ctx.roomId } });
    expect(room.serviceStatus).toBe('oos');
    expect(room.serviceReason).toContain('Water leak');
    console.log('7.1 S1 OK — room blocked on critical ticket');
  }, 60000);

  it('S2: completing the ticket clears the room', async () => {
    await svc.completeTask(ctx.t, ctx.taskId, agent.userId ?? 'tester');
    const room = await prisma.room.findFirst({ where: { id: ctx.roomId } });
    expect(room.serviceStatus).toBe('active');
    expect(room.serviceReason).toBeNull();
    console.log('7.1 S2 OK — room cleared on resolve');
  }, 60000);

  it('S3: a second blocking ticket holds the room until it resolves too', async () => {
    const a = await createBlocking('HVAC failure');
    const b = await createBlocking('Broken window');
    const roomNow = await prisma.room.findFirst({ where: { id: ctx.roomId } });
    expect(roomNow.serviceStatus).toBe('oos');

    await svc.completeTask(ctx.t, a.body.data.id, agent.userId ?? 'tester');
    const stillBlocked = await prisma.room.findFirst({ where: { id: ctx.roomId } });
    expect(stillBlocked.serviceStatus).toBe('oos');

    await svc.completeTask(ctx.t, b.body.data.id, agent.userId ?? 'tester');
    const cleared = await prisma.room.findFirst({ where: { id: ctx.roomId } });
    expect(cleared.serviceStatus).toBe('active');
    console.log('7.1 S3 OK — multi-ticket hold respected');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
