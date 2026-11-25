/* P40 — D7 gift vouchers: sell/redeem/refund lifecycle, folio payment on
 * redemption, liability report balancing, double-redeem + refund guards,
 * tenant scoping, role gate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let adminToken: string;
let staffToken: string;
let otherAgent: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  const H = { Authorization: 'Bearer ' + agent.token };
  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string, tag: string) => {
    const email = `gv-${tag}-${role}-${runId}@example.com`;
    const password = 'gv-evidence-1234';
    await request(app)
      .post('/v1/users')
      .set(H)
      .send({ email, firstName: 'GV', lastName: role, password, role });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  adminToken = await mkUser('owner', 'a');
  staffToken = await mkUser('staff', 's');
  otherAgent = await mod.registerTestAgent(app);
  ctx.admin = () => ({ Authorization: 'Bearer ' + adminToken });
  ctx.staff = () => ({ Authorization: 'Bearer ' + staffToken });
  ctx.other = () => ({ Authorization: 'Bearer ' + otherAgent.token });

  const prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'GV',
      code: ('GV' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const guest = await prisma.guest.create({
    data: {
      tenantId: agent.tenantId,
      firstName: 'GV',
      lastName: 'Guest',
      email: `gv-${runId}@example.com`,
    },
  });
  const res = await prisma.reservation.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: prop.id,
      guestId: guest.id,
      confirmationNumber: 'GV' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 800,
      balance: 0,
    },
  });
  ctx.folio = await prisma.folio.create({
    data: {
      tenantId: agent.tenantId,
      reservationId: res.id,
      totalCharges: 800,
      totalPayments: 0,
      balance: 800,
    },
  });
  ctx.tenantId = agent.tenantId;
  console.log('P40 seeded');
}, 90000);

describe('P40 gift vouchers (D7)', () => {
  it('S1: sell increases outstanding liability', async () => {
    const r = await request(app)
      .post('/v1/vouchers/sell')
      .set(ctx.admin())
      .send({
        amount: 1500,
        purchaserName: 'Ada Buyer',
        purchaserEmail: `ada-${runId}@example.com`,
        paymentRef: 'paystack-test-ref-1',
      });
    expect(r.status).toBe(201);
    expect(r.body.data.code).toMatch(/^VIM-/);
    expect(r.body.data.status).toBe('sold');
    ctx.voucher = r.body.data;

    const liab = await request(app).get('/v1/vouchers/liability').set(ctx.admin());
    expect(liab.body.data.outstanding).toBe(1500);
    console.log('P40 S1 OK — sold, liability up');
  }, 60000);

  it('S2: redeem posts a folio payment and reduces liability', async () => {
    const r = await request(app)
      .post('/v1/vouchers/redeem')
      .set(ctx.admin())
      .send({ code: ctx.voucher.code, folioId: ctx.folio.id });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('redeemed');
    expect(r.body.data.redeemedFolioId).toBe(ctx.folio.id);

    const folio = await prisma.folio.findFirst({ where: { id: ctx.folio.id } });
    expect(Number(folio.balance)).toBe(800 - 1500);
    const paymentItem = await prisma.folioItem.findFirst({
      where: {
        folioId: ctx.folio.id,
        type: 'payment',
        description: { contains: ctx.voucher.code },
      },
    });
    expect(paymentItem).toBeTruthy();

    const liab = await request(app).get('/v1/vouchers/liability').set(ctx.admin());
    expect(liab.body.data.outstanding).toBe(0);
    expect(liab.body.data.leftLiability).toBe(1500);
    expect(liab.body.data.check).toBe(-1500);
    console.log('P40 S2 OK — redeemed, folio paid, liability balanced');
  }, 60000);

  it('S3: double-redeem and refund-after-redeem guards', async () => {
    const again = await request(app)
      .post('/v1/vouchers/redeem')
      .set(ctx.admin())
      .send({ code: ctx.voucher.code, folioId: ctx.folio.id });
    expect(again.status).toBe(409);

    const refundRes = await request(app)
      .post(`/v1/vouchers/${ctx.voucher.id}/refund`)
      .set(ctx.admin())
      .send({ reason: 'test guard' });
    expect(refundRes.status).toBe(409);
    console.log('P40 S3 OK — lifecycle guards hold');
  }, 60000);

  it('S4: refund a sold voucher; scoping + role gate', async () => {
    const s = await request(app)
      .post('/v1/vouchers/sell')
      .set(ctx.admin())
      .send({ amount: 500, purchaserName: 'Bob', purchaserEmail: `bob-${runId}@example.com` });
    const rf = await request(app)
      .post(`/v1/vouchers/${s.body.data.id}/refund`)
      .set(ctx.admin())
      .send({ reason: 'changed mind' });
    expect(rf.status).toBe(200);
    expect(rf.body.data.status).toBe('refunded');

    const foreign = await request(app)
      .post('/v1/vouchers/redeem')
      .set(ctx.other())
      .send({ code: ctx.voucher.code, folioId: ctx.folio.id });
    expect([403, 404]).toContain(foreign.status);

    const staffSell = await request(app)
      .post('/v1/vouchers/sell')
      .set(ctx.staff())
      .send({ amount: 100, purchaserName: 'X', purchaserEmail: `x-${runId}@example.com` });
    expect(staffSell.status).toBe(403);
    console.log('P40 S4 OK — refund path, scoping, role gate');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
