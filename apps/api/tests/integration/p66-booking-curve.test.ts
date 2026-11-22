/* 6.6 — booking curve vs baseline: cumulative this period vs same window
 * one year ago. */
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
      name: 'CV',
      code: ('CV' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'CV', lastName: 'Guest', email: `cv-${runId}@example.com` },
  });
  const mk = async (conf: string, arrival: Date) =>
    prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber: conf,
        status: 'confirmed',
        arrivalDate: arrival,
        departureDate: new Date(arrival.getTime() + 2 * 86400_000),
        nights: 2,
        totalAmount: 1000,
        balance: 0,
      },
    });
  // 2 arrivals this period (5 and 10 days ago), 1 arrival in the baseline window (a year ago)
  await mk('CVNOW1' + runId.toUpperCase().slice(-5), new Date(Date.now() - 5 * 86400_000));
  await mk('CVNOW2' + runId.toUpperCase().slice(-5), new Date(Date.now() - 10 * 86400_000));
  await mk('CVBASE' + runId.toUpperCase().slice(-5), new Date(Date.now() - 365 * 86400_000));
  ctx.t = t;
  ctx.propId = prop.id;
  console.log('6.6 seeded');
}, 90000);

describe('6.6 booking curve', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });

  it('S1: cumulative series monotonic; baseline from the year-ago window', async () => {
    const r = await request(app)
      .get(`/v1/bi/booking-curve?propertyId=${ctx.propId}&days=30`)
      .set(H());
    expect(r.status).toBe(200);
    const { series, totals } = r.body.data;
    expect(series.length).toBe(31);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].cumulative).toBeGreaterThanOrEqual(series[i - 1].cumulative);
    }
    expect(totals.current).toBe(2);
    expect(totals.baseline).toBe(1);
    expect(totals.delta).toBe(1);
    console.log('6.6 S1 OK — curve + baseline exact');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
