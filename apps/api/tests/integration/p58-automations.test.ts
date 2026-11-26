/* P58 — automations v1: workflow+steps CRUD, event trigger with conditions,
 * delay/resume with the progress cursor (no double-fire), folio_item action
 * via the sellProduct chokepoint, cron tick, storage, scoping.
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
  const H = { Authorization: 'Bearer ' + agent.token };
  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string) => {
    const email = `au-${role}-${runId}@example.com`;
    const password = 'au-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'AU',
      lastName: role,
      password,
      role,
    });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.staffToken = await mkUser('staff');
  ctx.staff = () => ({ Authorization: 'Bearer ' + ctx.staffToken });

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'AU',
      code: ('AU' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.product = await prisma.upsellProduct.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'Late checkout',
      price: 300,
      status: 'active',
    },
  });
  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'AU', lastName: 'Guest' },
  });
  ctx.res = await prisma.reservation.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      guestId: guest.id,
      confirmationNumber: 'AU' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 100,
      balance: 100,
    },
  });
  await prisma.folio.create({
    data: {
      tenantId: agent.tenantId,
      reservationId: ctx.res.id,
      totalCharges: 100,
      totalPayments: 0,
      balance: 100,
    },
  });
  await prisma.folioItem.create({
    data: {
      folioId: (await prisma.folio.findFirst({ where: { reservationId: ctx.res.id } }))!.id,
      type: 'room_charge',
      description: 'Stay',
      amount: 100,
    },
  });

  ctx.engine = await import('../../src/modules/automations/automation.service.js');
  console.log('P58 seeded');
}, 90000);

describe('P58 automations v1', () => {
  it('S1: workflow + nested steps CRUD; unknown action rejected', async () => {
    const w = await request(app)
      .post('/v1/automations/workflows')
      .set(ctx.staff())
      .send({
        name: 'VIP arrival care',
        triggerType: 'event',
        eventKey: 'reservation.checked_in',
        propertyId: ctx.prop.id,
        steps: [
          { type: 'condition', config: { all: [{ field: 'vip', op: 'eq', value: true }] } },
          {
            type: 'action',
            config: {
              type: 'create_task',
              propertyId: ctx.prop.id,
              department: 'concierge',
              title: 'VIP welcome — {{guestName}}',
            },
          },
        ],
      });
    expect(w.status).toBe(201);
    ctx.workflowId = w.body.data.id;
    expect(w.body.data.steps.length).toBe(2);
    expect(w.body.data.steps[1].config.type).toBe('create_task');

    const bad = await request(app)
      .post('/v1/automations/workflows')
      .set(ctx.staff())
      .send({
        name: 'Bad action',
        triggerType: 'manual',
        steps: [{ type: 'action', config: { type: 'explode' } }],
      });
    expect(bad.status).toBe(400);
    console.log('P58 S1 OK — CRUD + validation');
  }, 60000);

  it('S2: event fire — matching condition creates the task; non-match skips', async () => {
    const hit = await ctx.engine.fireTrigger(ctx.tenantId, 'reservation.checked_in', {
      vip: true,
      guestName: 'Naledi M',
      reservationId: ctx.res.id,
    });
    expect(hit.fired).toBe(1);
    expect(hit.runs[0].status).toBe('completed');
    const trace = hit.runs[0].executionTrace as Array<{ type: string; detail: string }>;
    expect(trace[0].type).toBe('condition');
    expect(trace[1].type).toBe('action');

    const tasks = await prisma.task.findMany({
      where: { tenantId: ctx.tenantId, title: { contains: 'Naledi' } },
    });
    expect(tasks.length).toBe(1);
    expect(tasks[0].source).toBe('manual');
    expect(JSON.stringify(tasks[0].metadata ?? {})).toContain(hit.runs[0].id);

    const miss = await ctx.engine.fireTrigger(ctx.tenantId, 'reservation.checked_in', {
      vip: false,
    });
    expect(miss.runs[0].status).toBe('skipped');
    const still = await prisma.task.count({
      where: { tenantId: ctx.tenantId, title: { contains: 'Naledi' } },
    });
    expect(still).toBe(1);
    console.log('P58 S2 OK — conditional fire + skip');
  }, 60000);

  it('S3: delay waits then resumes without double-firing; folio_item posts', async () => {
    const w = await request(app)
      .post('/v1/automations/workflows')
      .set(ctx.staff())
      .send({
        name: 'Welcome charge',
        triggerType: 'event',
        eventKey: 'guest.welcomed',
        propertyId: ctx.prop.id,
        steps: [
          { type: 'delay', config: { minutes: 0 } },
          {
            type: 'action',
            config: {
              type: 'folio_item',
              reservationId: ctx.res.id,
              productId: ctx.product.id,
              quantity: 1,
            },
          },
        ],
      });
    expect(w.status).toBe(201);

    const fire = await ctx.engine.fireTrigger(ctx.tenantId, 'guest.welcomed', {});
    expect(fire.runs[0].status).toBe('waiting');

    // Action must NOT have run yet.
    const folio = await prisma.folio.findFirst({ where: { reservationId: ctx.res.id } });
    expect(Number(folio.totalCharges)).toBe(100);

    const resume = await ctx.engine.resumeDueRuns(new Date(Date.now() + 60_000), ctx.tenantId);
    expect(resume.resumed).toBe(1);
    expect(resume.runs[0].status).toBe('completed');

    const folioAfter = await prisma.folio.findFirst({ where: { reservationId: ctx.res.id } });
    expect(Number(folioAfter.totalCharges)).toBe(400);
    const fi = await prisma.folioItem.findFirst({
      where: { folioId: folioAfter.id, type: 'upsell' },
    });
    expect(fi).toBeTruthy();
    console.log('P58 S3 OK — delay/resume cursor + folio action');
  }, 60000);

  it('S4: cron tick fires due workflows only; storage round-trip', async () => {
    await request(app)
      .post('/v1/automations/workflows')
      .set(ctx.staff())
      .send({
        name: 'Nightly sweep',
        triggerType: 'cron',
        cronMinutes: 60,
        propertyId: ctx.prop.id,
        steps: [{ type: 'action', config: { type: 'log', message: 'sweep ran' } }],
      });

    const tick1 = await ctx.engine.runCronTick();
    expect(tick1.fired).toBeGreaterThanOrEqual(1);
    const tick2 = await ctx.engine.runCronTick();
    expect(tick2.fired).toBe(0); // not due again yet

    await request(app)
      .put('/v1/automations/storage/lastSweep')
      .set(ctx.staff())
      .send({ value: { at: 'now' } });
    const got = await request(app).get('/v1/automations/storage/lastSweep').set(ctx.staff());
    expect(got.body.data.value.at).toBe('now');
    console.log('P58 S4 OK — cron cadence + storage');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
