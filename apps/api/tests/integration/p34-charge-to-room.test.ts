/* P34 — charge-to-room quick action: guest-first posting via the postCharge
 * chokepoint. In-house only (checked_in); folio-open credit check inherent.
 */
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
      name: 'C2R',
      code: ('C2R' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'C2R', lastName: 'Guest', email: `c2r-${runId}@example.com` },
  });
  const mkRes = (status: string) =>
    prisma.reservation.create({
      data: {
        tenantId: t,
        propertyId: prop.id,
        guestId: g.id,
        confirmationNumber:
          'C2R' + status.slice(0, 3).toUpperCase() + runId.toUpperCase().slice(-4),
        status,
        arrivalDate: new Date(),
        departureDate: new Date(Date.now() + 86400_000),
        nights: 1,
        totalAmount: 1000,
        balance: 0,
      },
    });
  const inHouse = await mkRes('checked_in');
  await prisma.folio.create({
    data: { tenantId: t, reservationId: inHouse.id, totalCharges: 0, totalPayments: 0, balance: 0 },
  });
  ctx.inHouse = inHouse;
  ctx.confirmed = await mkRes('confirmed');
  ctx.t = t;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('P34 seeded');
}, 90000);

describe('P34 charge-to-room', () => {
  it('S1: in-house guest charge posts via the chokepoint (<30s workflow)', async () => {
    const r = await request(app)
      .post('/v1/folios/charge-to-room')
      .set(ctx.H())
      .send({ reservationId: ctx.inHouse.id, description: 'Spa — late arrival', amount: 750 });
    expect([200, 201]).toContain(r.status);
    expect(Number(r.body.data.amount)).toBe(750);
    expect(r.body.data.consumedAt).toBeTruthy();
    const folio = await prisma.folio.findFirst({ where: { reservationId: ctx.inHouse.id } });
    expect(Number(folio.totalCharges)).toBe(750);
    expect(Number(folio.balance)).toBe(750);
    console.log('P34 S1 OK — posted, consumedAt stamped, balance up');
  }, 60000);

  it('S2: not-in-house (confirmed) rejected with 409', async () => {
    const r = await request(app)
      .post('/v1/folios/charge-to-room')
      .set(ctx.H())
      .send({ reservationId: ctx.confirmed.id, description: 'x', amount: 10 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('NOT_IN_HOUSE');
    console.log('P34 S2 OK — in-house gate holds');
  }, 60000);

  it('S3: validation + missing folio paths', async () => {
    const bad = await request(app)
      .post('/v1/folios/charge-to-room')
      .set(ctx.H())
      .send({ reservationId: ctx.inHouse.id, description: '', amount: -5 });
    expect(bad.status).toBe(400);

    const g2 = await prisma.guest.create({
      data: {
        tenantId: ctx.t,
        firstName: 'No',
        lastName: 'Folio',
        email: `nf-${runId}@example.com`,
      },
    });
    const resNoFolio = await prisma.reservation.create({
      data: {
        tenantId: ctx.t,
        propertyId: ctx.inHouse.propertyId,
        guestId: g2.id,
        confirmationNumber: 'C2RNF' + runId.toUpperCase().slice(-4),
        status: 'checked_in',
        arrivalDate: new Date(),
        departureDate: new Date(Date.now() + 86400_000),
        nights: 1,
        totalAmount: 100,
        balance: 0,
      },
    });
    const nf = await request(app)
      .post('/v1/folios/charge-to-room')
      .set(ctx.H())
      .send({ reservationId: resNoFolio.id, description: 'y', amount: 10 });
    expect(nf.status).toBe(409);
    expect(nf.body.error.code).toBe('NO_FOLIO');
    console.log('P34 S3 OK — validation + no-folio paths');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
