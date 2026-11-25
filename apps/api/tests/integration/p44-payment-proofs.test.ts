/* P44 — EFT proof-of-payment: record POP against a reservation, verify (posts
 * the folio payment through the chokepoint), reject, lifecycle guards,
 * tenant scoping.
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
  ctx.tenantId = agent.tenantId;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });

  const prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'PP',
      code: ('PP' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'PP', lastName: 'Guest' },
  });
  const res = await prisma.reservation.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: prop.id,
      guestId: guest.id,
      confirmationNumber: 'PP' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 2000,
      balance: 2000,
    },
  });
  ctx.reservationId = res.id;
  ctx.folio = await prisma.folio.create({
    data: {
      tenantId: agent.tenantId,
      reservationId: res.id,
      totalCharges: 2000,
      totalPayments: 0,
      balance: 2000,
    },
  });
  ctx.otherAgent = await mod.registerTestAgent(app);
  ctx.other = () => ({ Authorization: 'Bearer ' + ctx.otherAgent.token });
  console.log('P44 seeded');
}, 90000);

describe('P44 EFT proof-of-payment', () => {
  it('S1: record a POP against the reservation', async () => {
    const r = await request(app).post('/v1/payment-proofs').set(ctx.H()).send({
      reservationId: ctx.reservationId,
      amount: 800,
      reference: 'EFT-2026-ABC123',
      note: 'WhatsApp PDF received',
    });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('pending');
    ctx.proofId = r.body.data.id;

    const list = await request(app)
      .get(`/v1/payment-proofs?reservationId=${ctx.reservationId}`)
      .set(ctx.H());
    expect(list.body.data.length).toBe(1);

    const bad = await request(app)
      .post('/v1/payment-proofs')
      .set(ctx.H())
      .send({ reservationId: 'nope', amount: 100 });
    expect(bad.status).toBe(404);
    console.log('P44 S1 OK — POP recorded + listed');
  }, 60000);

  it('S2: verify posts the folio payment through the chokepoint', async () => {
    const r = await request(app)
      .post(`/v1/payment-proofs/${ctx.proofId}/verify`)
      .set(ctx.H())
      .send({ folioId: ctx.folio.id });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('verified');
    expect(r.body.data.verifiedFolioId).toBe(ctx.folio.id);

    const folio = await prisma.folio.findFirst({ where: { id: ctx.folio.id } });
    expect(Number(folio.balance)).toBe(1200);
    const payment = await prisma.folioItem.findFirst({
      where: { folioId: ctx.folio.id, type: 'payment' },
    });
    expect(payment.description).toContain('EFT-2026-ABC123');
    expect(payment.description).toContain('POP verified');

    const again = await request(app)
      .post(`/v1/payment-proofs/${ctx.proofId}/verify`)
      .set(ctx.H())
      .send({ folioId: ctx.folio.id });
    expect(again.status).toBe(409);
    console.log('P44 S2 OK — verify = folio payment + match');
  }, 60000);

  it('S3: reject path + scoping', async () => {
    const p2 = await request(app)
      .post('/v1/payment-proofs')
      .set(ctx.H())
      .send({ reservationId: ctx.reservationId, amount: 100, reference: 'EFT-DOUBT' });
    const rj = await request(app)
      .post(`/v1/payment-proofs/${p2.body.data.id}/reject`)
      .set(ctx.H())
      .send({ reason: 'Reference not on statement' });
    expect(rj.status).toBe(200);
    expect(rj.body.data.status).toBe('rejected');

    const verifyRejected = await request(app)
      .post(`/v1/payment-proofs/${p2.body.data.id}/verify`)
      .set(ctx.H())
      .send({ folioId: ctx.folio.id });
    expect(verifyRejected.status).toBe(409);

    const foreign = await request(app)
      .post(`/v1/payment-proofs/${ctx.proofId}/verify`)
      .set(ctx.other())
      .send({ folioId: ctx.folio.id });
    expect([403, 404]).toContain(foreign.status);
    console.log('P44 S3 OK — reject + verify-rejected guard + scoping');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
