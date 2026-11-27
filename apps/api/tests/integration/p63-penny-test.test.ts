/* P63 — D-1 block 2: tenant-scoped payment flows (the request middleware
 * resolves the tenant keys for every downstream call) + the penny test.
 * The paystack module is stubbed at the boundary; the stub records which
 * credential scope was active at call time — proving tenant-key routing
 * without the network.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const seenScopes: Array<string | null> = [];

vi.mock('../../src/common/paystack.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, any>;
  const scope = () => actual.currentPaystackCredentials()?.secretKey ?? null;
  return {
    ...actual,
    initializeTransaction: async (input: any) => {
      seenScopes.push(scope());
      return {
        authorization_url: 'https://checkout.paystack.com/mock',
        reference: input.reference,
      };
    },
    verifyTransaction: async () => {
      seenScopes.push(scope());
      return {
        id: 1,
        status: 'success',
        amount: 100,
        authorization: { authorization_code: 'AUTH_test' },
      };
    },
    chargeAuthorization: async () => {
      seenScopes.push(scope());
      return { id: 2, status: 'success' };
    },
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
  ctx.agent = agent;

  const secrets = await import('../../src/common/secrets.js');
  await prisma.tenant.update({
    where: { id: agent.tenantId },
    data: {
      paystackSecretEnc: secrets.encryptSecret('sk_hotel_' + runId),
      paystackPublicKey: 'pk_hotel_' + runId,
    },
  });

  ctx.noKeys = await mod.registerTestAgent(app);
  ctx.noKeysH = () => ({ Authorization: 'Bearer ' + ctx.noKeys.token });
  console.log('P63 seeded');
}, 90000);

describe('P63 tenant-scoped payments + penny test', () => {
  it('S1: penny test starts through the TENANT keys; no-keys tenant refused', async () => {
    const begin = await request(app).post('/v1/payments/penny-test').set(ctx.H);
    expect(begin.status).toBe(201);
    expect(begin.body.data.authorizationUrl).toContain('checkout.paystack');
    expect(seenScopes).toContain('sk_hotel_' + runId);
    ctx.pennyRef = begin.body.data.reference;

    const refused = await request(app).post('/v1/payments/penny-test').set(ctx.noKeysH());
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('NO_TENANT_KEYS');
    console.log('P63 S1 OK — tenant-key routing + refusal');
  }, 60000);

  it('S2: penny verify stamps the tenant; idempotent on repeat', async () => {
    const ok = await request(app).get(`/v1/payments/penny-test/verify/${ctx.pennyRef}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.ok).toBe(true);
    expect(ok.body.data.already).toBe(false);

    const again = await request(app).get(`/v1/payments/penny-test/verify/${ctx.pennyRef}`);
    expect(again.body.data.already).toBe(true);

    const tenant = await prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    expect(tenant.pennyTestAt).toBeTruthy();
    console.log('P63 S2 OK — penny gate green, idempotent');
  }, 60000);

  it('S3: preauth capture rides the tenant scope too', async () => {
    const prop = await prisma.property.create({
      data: {
        tenantId: ctx.tenantId,
        name: 'PT',
        code: ('PT' + runId)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(-12),
      },
    });
    const guest = await prisma.guest.create({
      data: { tenantId: ctx.tenantId, firstName: 'PT', lastName: 'Guest' },
    });
    const res = await prisma.reservation.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: prop.id,
        guestId: guest.id,
        confirmationNumber: 'PT' + runId.toUpperCase().slice(-6),
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
        tenantId: ctx.tenantId,
        reservationId: res.id,
        totalCharges: 100,
        totalPayments: 0,
        balance: 100,
      },
    });
    await prisma.folioItem.create({
      data: {
        folioId: (await prisma.folio.findFirst({ where: { reservationId: res.id } }))!.id,
        type: 'room_charge',
        description: 'Stay',
        amount: 100,
      },
    });

    const hold = await request(app)
      .post('/v1/preauth')
      .set(ctx.H)
      .send({
        propertyId: prop.id,
        reservationId: res.id,
        email: `pt-${runId}@example.com`,
        amountMinor: 5000,
      });
    const holdId = hold.body.data.id;
    const svc = await import('../../src/modules/preauth/preauth.service.js');
    await svc.attachAuthorization(holdId, 'AUTH_scope', 999123);

    const before = seenScopes.length;
    const cap = await request(app).post(`/v1/preauth/${holdId}/capture`).set(ctx.H);
    expect(cap.status).toBe(200);
    expect(seenScopes.length).toBeGreaterThan(before);
    expect(seenScopes).toContain('sk_hotel_' + runId);
    console.log('P63 S3 OK — capture tenant-scoped');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
