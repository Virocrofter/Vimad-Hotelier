/* 7.6 — HK auto-trigger rules over the existing cadence engine.
 * S1: hk-stayover-clean generates one task per in-house room spanning tonight
 *     (DATE-column-safe: arrival ≤ yesterday-UTC, departure ≥ tomorrow-UTC).
 * S2: hk-linen-change flags every room past the interval; a recently-serviced
 *     room (last done task within intervalDays) is skipped.
 * S3: hk-legionella-flush flags rooms with no checked_in stay in N days.
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
      name: 'HK',
      code: ('HK' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'HK RT',
      code: 'HKRT' + runId.toUpperCase().slice(-4),
    },
  });
  const mk = (num: string) =>
    prisma.room.create({
      data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: num, floor: '1' },
    });
  ctx.rStay = await mk('HK-101'); // in-house tonight -> stayover clean
  ctx.rLinen = await mk('HK-102'); // linen: no prior task -> due
  ctx.rLinenDone = await mk('HK-103'); // linen: recent done task -> skipped
  ctx.rVacant = await mk('HK-104'); // legionella: vacant -> flush
  ctx.rOccupied = await mk('HK-105'); // legionella: occupied -> skipped
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'HK', lastName: 'Guest', email: `hk-${runId}@example.com` },
  });
  const mkRes = (over: Record<string, unknown>) =>
    prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber: 'HK' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        status: 'confirmed',
        arrivalDate: new Date(),
        departureDate: new Date(Date.now() + 2 * 86400_000),
        nights: 2,
        totalAmount: 1000,
        balance: 0,
        ...over,
      } as any,
    });
  const stayRes = await mkRes({
    status: 'checked_in',
    arrivalDate: new Date(Date.now() - 86400_000),
    departureDate: new Date(Date.now() + 2 * 86400_000),
  });
  await prisma.reservationStay.create({
    data: { reservationId: stayRes.id, roomId: ctx.rStay.id, date: new Date(), rate: 500 },
  });
  const occRes = await mkRes({
    status: 'checked_in',
    arrivalDate: new Date(Date.now() - 86400_000),
    departureDate: new Date(Date.now() + 2 * 86400_000),
  });
  await prisma.reservationStay.create({
    data: { reservationId: occRes.id, roomId: ctx.rOccupied.id, date: new Date(), rate: 500 },
  });
  ctx.propId = prop.id;
  ctx.t = t;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  const rules: Record<string, string> = {};
  for (const [key, extra] of [
    ['hk-stayover-clean', {}],
    ['hk-linen-change', { config: { intervalDays: 7 } }],
    ['hk-legionella-flush', { config: { days: 7 } }],
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
          title: `HK: ${key} — {{roomNumber}}`,
          department: 'housekeeping',
          priority: 'normal',
        },
        ...extra,
      });
    expect(r.status, key).toBe(201);
    rules[key] = r.body.data.id;
  }
  ctx.rules = rules;
  console.log('7.6 seeded');
}, 90000);

describe('7.6 HK auto-trigger rules', () => {
  it('S1: stayover clean generates for the in-house room', async () => {
    const created = await svc.evaluateRule(ctx.rules['hk-stayover-clean']);
    expect(created).toBe(1);
    const task = await prisma.task.findFirst({ where: { ruleId: ctx.rules['hk-stayover-clean'] } });
    expect(task.roomId).toBe(ctx.rStay.id);
    expect(task.title).toContain('HK-101');
    console.log('7.6 S1 OK — stayover task generated');
  }, 60000);

  it('S2: linen interval — every unserviced room due, recently-serviced skipped', async () => {
    await prisma.task.create({
      data: {
        tenantId: ctx.t,
        propertyId: ctx.propId,
        department: 'housekeeping',
        title: 'Linen done recently',
        status: 'done',
        ruleId: ctx.rules['hk-linen-change'],
        roomId: ctx.rLinenDone.id,
      },
    });
    const created = await svc.evaluateRule(ctx.rules['hk-linen-change']);
    expect(created).toBe(4);
    const tasks = await prisma.task.findMany({
      where: { ruleId: ctx.rules['hk-linen-change'], status: { in: ['open', 'in_progress'] } },
    });
    expect(tasks.map((x: any) => x.roomId).sort()).toEqual(
      [ctx.rStay.id, ctx.rLinen.id, ctx.rVacant.id, ctx.rOccupied.id].sort()
    );
    console.log('7.6 S2 OK — interval respected both directions');
  }, 60000);

  it('S3: legionella flags never-occupied rooms, skips occupied and stayover', async () => {
    const created = await svc.evaluateRule(ctx.rules['hk-legionella-flush']);
    const tasks = await prisma.task.findMany({
      where: { ruleId: ctx.rules['hk-legionella-flush'] },
    });
    const roomIds = tasks.map((x: any) => x.roomId).sort();
    expect(roomIds).toEqual([ctx.rLinen.id, ctx.rLinenDone.id, ctx.rVacant.id].sort());
    expect(created).toBe(tasks.length);
    console.log('7.6 S3 OK — flush targets vacant rooms only');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
