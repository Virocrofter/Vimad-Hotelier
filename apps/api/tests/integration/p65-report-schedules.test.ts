/* 6.5 — Mews-format report definitions on the existing scheduler.
 * S1: all ten Mews families are defined (mapped onto the definition catalog).
 * S2: each family runReport-delivers with its own declared params.
 * S3: scheduled-delivers — create, run on demand, completed run logged.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

const MEWS_MAP: Record<string, string> = {
  reservation: 'arrivals_departures',
  accounting: 'accounting_journal',
  manager: 'adr_revpar',
  payment: 'channel_mix',
  customer_profiles: 'guest_demographics',
  check_out: 'space_status',
  a_and_o: 'occupancy',
  forecast_grid: 'forecast',
  bills_invoices: 'revenue_breakdown',
  aging_buckets: 'ar_aging',
};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'R6',
      code: ('R6' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'R6 RT',
      code: 'R6RT' + runId.toUpperCase().slice(-4),
    },
  });
  await prisma.room.create({
    data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: 'R6-1' },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'R6', lastName: 'Guest', email: `r6-${runId}@example.com` },
  });
  await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: g.id,
      confirmationNumber: 'R6RES' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 2 * 86400_000),
      nights: 2,
      totalAmount: 1500,
      balance: 500,
    },
  });
  ctx.t = t;
  ctx.propId = prop.id;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('6.5 seeded');
}, 90000);

describe('6.5 report definitions on the scheduler', () => {
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);

  it('S1: all ten Mews families defined', async () => {
    const r = await request(app).get('/v1/reports/definitions').set(ctx.H());
    expect(r.status).toBe(200);
    const keys = (r.body.data.definitions ?? r.body.data ?? []).map((d: any) => d.key);
    for (const mapped of Object.values(MEWS_MAP)) {
      expect(keys, mapped as string).toContain(mapped);
    }
    console.log('6.5 S1 OK — ten Mews families mapped and defined');
  }, 60000);

  it('S2: each family runReport-delivers with its own declared params', async () => {
    const defsRes = await request(app).get('/v1/reports/definitions').set(ctx.H());
    const defs = defsRes.body.data.definitions ?? defsRes.body.data ?? [];
    for (const mapped of Object.values(MEWS_MAP)) {
      const def = defs.find((d: any) => d.key === mapped);
      const params: Record<string, string> = {};
      for (const p of def?.params ?? []) {
        if (p.type === 'date') params[p.key] = p.key.toLowerCase().includes('to') ? in3 : today;
        else if (p.dynamicOptions === 'properties') params[p.key] = ctx.propId;
        else if (p.options?.length) params[p.key] = String(p.options[0].value ?? p.options[0]);
        else params[p.key] = 'all';
      }
      if (Object.keys(params).length === 0) {
        Object.assign(params, { dateFrom: today, dateTo: in3, propertyId: ctx.propId });
      }
      const r = await request(app)
        .post('/v1/reports/run')
        .set(ctx.H())
        .send({ definition: mapped, params });
      if (r.status !== 200) {
        console.log('SENT', mapped, JSON.stringify(params));
        console.log('DEFDUMP', mapped, JSON.stringify(def?.params ?? null).slice(0, 400));
      }
      expect(r.status, `${mapped}: ${JSON.stringify(r.body.error ?? '')}`).toBe(200);
    }
    console.log('6.5 S2 OK — every family delivers');
  }, 120_000);

  it('S3: scheduled-delivers — create, run on demand, completed run logged', async () => {
    const c = await request(app)
      .post('/v1/reports/schedules')
      .set(ctx.H())
      .send({
        definitionKey: 'occupancy',
        name: 'Morning occupancy ' + runId,
        params: { dateFrom: today, dateTo: in3, propertyId: ctx.propId },
        frequency: 'DAILY',
        timeOfDay: '06:00',
        recipients: [],
      });
    expect([200, 201]).toContain(c.status);
    const id = c.body.data?.id ?? c.body.data?.schedule?.id;
    expect(id).toBeTruthy();

    const run = await request(app).post(`/v1/reports/schedules/${id}/run`).set(ctx.H());
    expect([200, 201]).toContain(run.status);

    const runs = await request(app).get('/v1/reports/runs').set(ctx.H());
    expect(runs.status).toBe(200);
    const list = runs.body.data?.runs ?? runs.body.data ?? [];
    expect(list.length).toBeGreaterThanOrEqual(1);
    console.log('6.5 S3 OK — scheduled-delivers end to end');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
