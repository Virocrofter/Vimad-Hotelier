/* E1x-V — Wave 1 rate-grid verification: seasonal boundaries under property
 * timezones. Pins the bug mechanics the UTC-midnight exceptions detector
 * exposed: naive Date math and toISOString().slice(0,10) round-trips that
 * shift calendar dates by the property's UTC offset.
 * S1: Africa/Johannesburg property — exact boundary quotes + materialized
 *     rate_override rows must carry EXACTLY the input date strings.
 * S2: multi-night stay straddling the boundary inside ONE quote — per-night
 *     attribution (out-rate night before, grid nights within).
 * S3: Pacific/Auckland (UTC+12) — the offset where any local->ISO round-trip
 *     shifts stored dates a full day; same pins as S1.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (base: Date, n: number) => new Date(base.getTime() + n * 86400_000);

async function seedProperty(t: string, tag: string, timezone: string) {
  const code = (tag + runId)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(-12);
  const prop = await prisma.property.create({
    data: { tenantId: t, name: tag, code, timezone },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: tag + ' RT',
      code: (tag + runId).toUpperCase().slice(-8),
    },
  });
  await prisma.room.create({
    data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: tag + '-1' },
  });
  const plan = await prisma.ratePlan.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      roomTypeId: rt.id,
      name: tag + ' Base',
      code: (tag + runId).toUpperCase().slice(-8),
      baseRate: 1000,
      status: 'active',
    },
  });
  return { propId: prop.id, rtId: rt.id, planId: plan.id, code };
}

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;

  // boundary: a stable date 10-13 days out (well inside the 370-day materialization cap)
  const start = addDays(new Date(), 10);
  const d0 = fmt(start);

  ctx.t = t;
  ctx.d0 = d0;
  ctx.dm1 = fmt(addDays(start, -1));
  ctx.dp1 = fmt(addDays(start, 1));
  ctx.dp2 = fmt(addDays(start, 2));
  ctx.dp3 = fmt(addDays(start, 3));
  ctx.dp4 = fmt(addDays(start, 4));

  ctx.jhb = await seedProperty(t, 'E1XJHB', 'Africa/Johannesburg');
  ctx.akl = await seedProperty(t, 'E1XAKL', 'Pacific/Auckland');
  console.log('E1x-V seeded', ctx.d0);
}, 90000);

describe('E1x-V rate-grid timezone verification', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });

  const quote = async (code: string, rtId: string, ci: string, co: string): Promise<any> => {
    const r = await request(app)
      .get('/v1/public/properties/' + code + '/availability')
      .query({ checkIn: ci, checkOut: co });
    expect(r.status).toBe(200);
    const rt = (r.body.data?.roomTypes ?? []).find((x: any) => x.roomTypeId === rtId);
    expect(rt).toBeTruthy();
    return rt;
  };

  const materializedDates = async (planId: string) => {
    const rows = await prisma.rateOverride.findMany({
      where: { ratePlanId: planId },
      orderBy: { date: 'asc' },
    });
    return rows.map((r: any) => fmt(new Date(r.date)));
  };

  it('S1: Africa/Johannesburg — exact boundaries + materialized dates are the input strings', async () => {
    const { rtId, planId, code } = ctx.jhb;
    const r = await request(app).post('/v1/rates/seasonal').set(H()).send({
      name: 'E1x JHB High',
      roomTypeId: rtId,
      ratePlanId: planId,
      startDate: ctx.d0,
      endDate: ctx.dp2,
      rate: 1450,
    });
    expect(r.status).toBe(201);

    expect((await quote(code, rtId, ctx.dm1, ctx.d0)).nightly[0].rate).toBe(1000);
    expect((await quote(code, rtId, ctx.d0, ctx.dp1)).nightly[0].rate).toBe(1450);
    expect((await quote(code, rtId, ctx.dp2, ctx.dp3)).nightly[0].rate).toBe(1450); // endDate INCLUSIVE
    expect((await quote(code, rtId, ctx.dp3, ctx.dp4)).nightly[0].rate).toBe(1000);

    const dates = await materializedDates(planId);
    expect(dates).toEqual([ctx.d0, ctx.dp1, ctx.dp2]);
    console.log('E1x-V S1 OK — JHB boundaries exact, rows unpolluted by TZ offset');
  }, 60000);

  it('S2: multi-night straddle inside one quote — per-night attribution', async () => {
    const { rtId, code } = ctx.jhb;
    const rt = await quote(code, rtId, ctx.dm1, ctx.dp2); // 3 nights: dm1, d0, dp1
    expect(rt.nightly.map((n: any) => n.rate)).toEqual([1000, 1450, 1450]);
    console.log('E1x-V S2 OK — straddle nights [base, grid, grid]');
  }, 60000);

  it('S3: Pacific/Auckland (UTC+12) — boundaries exact, no ISO round-trip shift', async () => {
    const { rtId, planId, code } = ctx.akl;
    const r = await request(app).post('/v1/rates/seasonal').set(H()).send({
      name: 'E1x AKL High',
      roomTypeId: rtId,
      ratePlanId: planId,
      startDate: ctx.d0,
      endDate: ctx.dp1,
      rate: 1450,
    });
    expect(r.status).toBe(201);

    expect((await quote(code, rtId, ctx.dm1, ctx.d0)).nightly[0].rate).toBe(1000);
    expect((await quote(code, rtId, ctx.d0, ctx.dp1)).nightly[0].rate).toBe(1450);
    expect((await quote(code, rtId, ctx.dp1, ctx.dp2)).nightly[0].rate).toBe(1450);
    expect((await quote(code, rtId, ctx.dp2, ctx.dp3)).nightly[0].rate).toBe(1000);

    const dates = await materializedDates(planId);
    expect(dates).toEqual([ctx.d0, ctx.dp1]);
    console.log('E1x-V S3 OK — UTC+12 property, zero date shift');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
