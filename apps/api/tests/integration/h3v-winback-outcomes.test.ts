/* H3-V — win-back run log + outcome measurement.
 * S1: a qualifying lapsed guest (departed inside the window, consented) is
 *     sent the win-back; the run log shows the recipient.
 * S2: record-open marks openedAt; repeat calls are idempotent (first wins).
 * S3: rebook attribution — a new reservation after the send is attributed;
 *     a sent-but-not-rebooked guest shows null; a too-recent stay is excluded;
 *     a second run is duplicate-suppressed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

const monthsAgo = (m: number) => new Date(Date.now() - m * 30.44 * 86400_000);

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;
  ctx.t = t;

  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'H3V',
      code: ('H3V' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const mkGuest = async (tag: string, departedMonthsAgo: number) => {
    const g = await prisma.guest.create({
      data: {
        tenantId: t,
        firstName: 'H3',
        lastName: tag,
        email: `h3-${tag.toLowerCase()}-${runId}@example.com`,
      },
    });
    await prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber: 'H3' + tag.toUpperCase() + runId.toUpperCase().slice(-6),
        status: 'checked_out',
        arrivalDate: new Date(monthsAgo(departedMonthsAgo).getTime() - 3 * 86400_000),
        departureDate: monthsAgo(departedMonthsAgo),
        nights: 3,
      },
    });
    return g;
  };

  ctx.lapsed = await mkGuest('Lapsed', 7); // inside the default 6–12 month window
  ctx.recent = await mkGuest('Recent', 1); // too recent — must be excluded
  for (const g of [ctx.lapsed, ctx.recent]) {
    await prisma.guestConsent.create({
      data: {
        tenantId: t,
        guestId: g.id,
        purpose: 'marketing',
        channel: 'email',
        status: 'granted',
        source: 'booking',
      },
    });
  }
  console.log('H3-V seeded');
}, 90000);

describe('H3-V win-back outcomes', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });
  const runs = async () =>
    (await request(app).get('/v1/marketing/winback/runs').set(H())).body.data as any[];

  it('S1: qualifying lapsed guest is sent; too-recent guest excluded', async () => {
    const r = await request(app).post('/v1/marketing/winback/run').set(H()).send({ dryRun: false });
    expect(r.status).toBe(200);
    expect(r.body.data.sent).toBeGreaterThanOrEqual(1);

    const log = await runs();
    const mine = log.filter((row) => row.to.includes('h3-'));
    expect(
      mine.some((row) => row.to === `h3-lapsed-${runId}@example.com` && row.status === 'queued')
    ).toBe(true);
    expect(mine.some((row) => row.to === `h3-recent-${runId}@example.com`)).toBe(false);
    ctx.sentRow = mine.find((row) => row.to === `h3-lapsed-${runId}@example.com`);
    expect(ctx.sentRow.openedAt).toBeNull();
    expect(ctx.sentRow.rebookedAt).toBeNull();
    console.log('H3-V S1 OK — sent to the lapsed, excluded the recent');
  }, 60000);

  it('S2: record-open marks openedAt; idempotent', async () => {
    const first = await request(app)
      .post('/v1/marketing/winback/record-open')
      .set(H())
      .send({ emailLogId: ctx.sentRow.id });
    expect(first.status).toBe(200);
    const afterFirst = (await runs()).find((r) => r.id === ctx.sentRow.id);
    expect(afterFirst.openedAt).toBeTruthy();
    const ts1 = afterFirst.openedAt;

    await request(app)
      .post('/v1/marketing/winback/record-open')
      .set(H())
      .send({ emailLogId: ctx.sentRow.id });
    const afterSecond = (await runs()).find((r) => r.id === ctx.sentRow.id);
    expect(afterSecond.openedAt).toBe(ts1);
    console.log('H3-V S2 OK — open recorded, first event wins');
  }, 60000);

  it('S3: rebook attributed; duplicate run suppressed', async () => {
    const prop = await prisma.property.findFirst({ where: { tenantId: ctx.t } });
    await prisma.reservation.create({
      data: {
        tenantId: ctx.t,
        propertyId: prop.id,
        guestId: ctx.lapsed.id,
        confirmationNumber: 'H3REBOOK' + runId.toUpperCase().slice(-6),
        status: 'confirmed',
        arrivalDate: new Date(Date.now() + 20 * 86400_000),
        departureDate: new Date(Date.now() + 22 * 86400_000),
        nights: 2,
      },
    });
    const attributed = (await runs()).find((r) => r.id === ctx.sentRow.id);
    expect(attributed.rebookedAt).toBeTruthy();
    expect(attributed.rebookedReservationId).toBeTruthy();

    const second = await request(app)
      .post('/v1/marketing/winback/run')
      .set(H())
      .send({ dryRun: false });
    expect(second.body.data.sent).toBe(0);
    expect(second.body.data.suppressed.recentContact).toBeGreaterThanOrEqual(1);
    console.log('H3-V S3 OK — rebook attributed, duplicate suppressed');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
