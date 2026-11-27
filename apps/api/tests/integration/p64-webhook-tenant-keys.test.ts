/* P64 — D-1 block 3: webhook signature verification is per-tenant (a
 * platform-signed event must be REJECTED once a hotel connects keys), and
 * the tenant-keys API rotates keys safely (secret never returned, penny
 * stamp cleared, scope cache invalidated).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

const sign = (body: string, secret: string) =>
  createHmac('sha512', secret).update(body).digest('hex');

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  const H = { Authorization: 'Bearer ' + agent.token };

  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string) => {
    const email = `wk-${role}-${runId}@example.com`;
    const password = 'wk-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'WK',
      lastName: role,
      password,
      role,
    });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.ownerToken = await mkUser('owner');
  ctx.staffToken = await mkUser('staff');
  ctx.owner = () => ({ Authorization: 'Bearer ' + ctx.ownerToken });
  ctx.staff = () => ({ Authorization: 'Bearer ' + ctx.staffToken });
  console.log('P64 seeded');
}, 90000);

describe('P64 webhook per-tenant + keys API', () => {
  it('S1: owner PUTs keys; GET state shows public key, never the secret', async () => {
    const put = await request(app)
      .put('/v1/payments/tenant-keys')
      .set(ctx.owner())
      .send({ secretKey: 'sk_hotel_' + runId, publicKey: 'pk_hotel_' + runId });
    expect(put.status).toBe(200);
    expect(put.body.data.connected).toBe(true);

    const got = await request(app).get('/v1/payments/tenant-keys').set(ctx.owner());
    expect(got.body.data.connected).toBe(true);
    expect(got.body.data.publicKey).toBe('pk_hotel_' + runId);
    expect(JSON.stringify(got.body)).not.toContain('sk_hotel_');

    const staffPut = await request(app)
      .put('/v1/payments/tenant-keys')
      .set(ctx.staff())
      .send({ secretKey: 'sk_x_123456789', publicKey: 'pk_x_12345' });
    expect(staffPut.status).toBe(403);
    console.log('P64 S1 OK — keys API + role gate + secret never returned');
  }, 60000);

  it('S2: webhook verifies with the TENANT key; platform-signed rejected', async () => {
    const payload = {
      event: 'charge.success',
      data: { reference: 'X1', id: 1, metadata: { tenantId: ctx.tenantId } },
    };
    const body = JSON.stringify(payload);

    const tenantSig = sign(body, 'sk_hotel_' + runId);
    const ok = await request(app)
      .post('/v1/payments/webhook')
      .set('x-paystack-signature', tenantSig)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(ok.status).toBe(200);

    const platformSig = sign(body, process.env.PAYSTACK_SECRET_KEY || 'platform-secret');
    const rejected = await request(app)
      .post('/v1/payments/webhook')
      .set('x-paystack-signature', platformSig)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(rejected.status).toBe(401);

    const wrongSig = sign(body, 'sk_attacker_123456789');
    const wrong = await request(app)
      .post('/v1/payments/webhook')
      .set('x-paystack-signature', wrongSig)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(wrong.status).toBe(401);
    console.log('P64 S2 OK — per-tenant webhook security');
  }, 60000);

  it('S3: key rotation clears the penny stamp; no-metadata events keep env fallback', async () => {
    await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: { pennyTestAt: new Date() },
    });
    const rot = await request(app)
      .put('/v1/payments/tenant-keys')
      .set(ctx.owner())
      .send({ secretKey: 'sk_rotated_' + runId, publicKey: 'pk_rotated_' + runId });
    expect(rot.status).toBe(200);
    const got = await request(app).get('/v1/payments/tenant-keys').set(ctx.owner());
    expect(got.body.data.pennyTestAt).toBeNull();

    // No tenantId in metadata → platform env verification still accepted.
    const payload = { event: 'charge.success', data: { reference: 'X2', id: 2 } };
    const body = JSON.stringify(payload);
    const platformSig = sign(body, process.env.PAYSTACK_SECRET_KEY || 'platform-secret');
    const legacy = await request(app)
      .post('/v1/payments/webhook')
      .set('x-paystack-signature', platformSig)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(legacy.status).toBe(200);
    console.log('P64 S3 OK — rotation semantics + platform fallback');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
