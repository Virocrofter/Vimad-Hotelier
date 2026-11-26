/* P60 — preauth holds: open → captured (folio capture, idempotent claim) |
 * voided (refund of the authorization charge). Gateway stubbed at the
 * boundary; the claim paths are the real settle logic.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

vi.mock('../../src/common/paystack.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    chargeAuthorization: async () => ({ id: 777001, status: 'success' }),
    createRefund: async () => ({ refundId: 777002 }),
  };
});

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  ctx.H = { Authorization: 'Bearer ' + agent.token };

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'PA',
      code: ('PA' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'PA', lastName: 'Guest' },
  });
  ctx.res = await prisma.reservation.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      guestId: guest.id,
      confirmationNumber: 'PA' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 1200,
      balance: 1200,
    },
  });
  ctx.folio = await prisma.folio.create({
    data: {
      tenantId: agent.tenantId,
      reservationId: ctx.res.id,
      totalCharges: 1200,
      totalPayments: 0,
      balance: 1200,
    },
  });
  await prisma.folioItem.create({
    data: {
      folioId: ctx.folio.id,
      type: 'room_charge',
      description: 'Stay',
      amount: 1200,
      consumedAt: new Date(),
    },
  });
  ctx.svc = await import('../../src/modules/preauth/preauth.service.js');
  console.log('P60 seeded');
}, 90000);

describe('P60 preauth holds', () => {
  it('S1: create hold; capture without authorization is refused', async () => {
    const c = await request(app)
      .post('/v1/preauth')
      .set(ctx.H)
      .send({
        propertyId: ctx.prop.id,
        reservationId: ctx.res.id,
        email: `pa-${runId}@example.com`,
        amountMinor: 15000,
      });
    expect(c.status).toBe(201);
    expect(c.body.data.status).toBe('open');
    expect(c.body.data.reference).toMatch(/^PAH-/);
    ctx.holdId = c.body.data.id;

    const early = await request(app).post(`/v1/preauth/${ctx.holdId}/capture`).set(ctx.H);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('HOLD_NOT_AUTHORIZED');
    console.log('P60 S1 OK — hold created, uncapturable pre-auth');
  }, 60000);

  it('S2: attach authorization → capture posts the folio, idempotent', async () => {
    await ctx.svc.attachAuthorization(ctx.holdId, 'AUTH_test_123', 555001);

    const cap = await request(app).post(`/v1/preauth/${ctx.holdId}/capture`).set(ctx.H);
    expect(cap.status).toBe(200);
    expect(cap.body.data.status).toBe('captured');

    const folio = await prisma.folio.findFirst({ where: { id: ctx.folio.id } });
    expect(Number(folio.totalCharges)).toBe(1350);
    const items = await prisma.folioItem.findMany({
      where: { folioId: ctx.folio.id, type: 'preauth_capture' },
    });
    expect(items.length).toBe(1);
    expect(Number(items[0].amount)).toBe(150);

    const again = await request(app).post(`/v1/preauth/${ctx.holdId}/capture`).set(ctx.H);
    expect(again.status).toBe(409); // already captured
    const itemsAfter = await prisma.folioItem.count({
      where: { folioId: ctx.folio.id, type: 'preauth_capture' },
    });
    expect(itemsAfter).toBe(1);
    console.log('P60 S2 OK — capture + idempotence');
  }, 60000);

  it('S3: void path refunds the authorization and closes the hold', async () => {
    const v = await request(app)
      .post('/v1/preauth')
      .set(ctx.H)
      .send({
        propertyId: ctx.prop.id,
        reservationId: ctx.res.id,
        email: `pa2-${runId}@example.com`,
        amountMinor: 5000,
      });
    const holdId = v.body.data.id;
    await ctx.svc.attachAuthorization(holdId, 'AUTH_test_456', 555002);

    const voided = await request(app).post(`/v1/preauth/${holdId}/void`).set(ctx.H);
    expect(voided.status).toBe(200);
    expect(voided.body.data.status).toBe('voided');

    const again = await request(app).post(`/v1/preauth/${holdId}/void`).set(ctx.H);
    expect(again.status).toBe(409);

    const folio = await prisma.folio.findFirst({ where: { id: ctx.folio.id } });
    expect(Number(folio.totalCharges)).toBe(1350); // void added nothing
    console.log('P60 S3 OK — void + guards');
  }, 60000);

  it('S4: list is scoped by reservation + tenant', async () => {
    const list = await request(app).get(`/v1/preauth?reservationId=${ctx.res.id}`).set(ctx.H);
    expect(list.body.data.length).toBe(2);

    const other = await request(app)
      .get('/v1/preauth')
      .set({ Authorization: 'Bearer someone-else' });
    expect([401, 403]).toContain(other.status);
    console.log('P60 S4 OK — scoping');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
