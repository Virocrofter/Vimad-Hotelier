/* P46 — TOTP two-factor: hand-rolled RFC 6238 (SHA-1/30s/6-digit) on
 * node:crypto. Setup → enable (code-verified) → login interjects with a
 * pending token → /login/2fa completes → disable restores direct login.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let creds: { tenantSlug: string; email: string; password: string };
let token: string;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  const H = { Authorization: 'Bearer ' + agent.token };
  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });

  creds = {
    tenantSlug: tenantRow?.slug ?? 'test',
    email: `2fa-owner-${runId}@example.com`,
    password: '2fa-evidence-1234',
  };
  await request(app).post('/v1/users').set(H).send({
    email: creds.email,
    firstName: '2FA',
    lastName: 'owner',
    password: creds.password,
    role: 'owner',
  });
  const lg = await request(app).post('/auth/login').send(creds);
  token = (lg.body?.data ?? lg.body)?.token;
  ctx.H = () => ({ Authorization: 'Bearer ' + token });
  ctx.auth = await import('../../src/modules/auth/auth.service.js');
  console.log('P46 seeded');
}, 90000);

describe('P46 TOTP two-factor', () => {
  it('S1: setup reveals a base32 secret; enable requires a valid code', async () => {
    const setup = await request(app).post('/auth/2fa/setup').set(ctx.H());
    expect(setup.status).toBe(200);
    ctx.secret = setup.body.data.secret;
    expect(ctx.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.body.data.otpauthUrl).toContain('otpauth://totp/');
    expect(ctx.auth.totpCode(ctx.secret)).toMatch(/^\d{6}$/);

    const wrong = await request(app).post('/auth/2fa/enable').set(ctx.H()).send({ code: '000000' });
    expect(wrong.status).toBe(400);

    const en = await request(app)
      .post('/auth/2fa/enable')
      .set(ctx.H())
      .send({ code: ctx.auth.totpCode(ctx.secret) });
    expect(en.status).toBe(200);
    expect(en.body.data.enabled).toBe(true);
    console.log('P46 S1 OK — setup + code-gated enable');
  }, 60000);

  it('S2: login interjects; /login/2fa completes the second factor', async () => {
    const lg = await request(app).post('/auth/login').send(creds);
    expect(lg.body.data.twoFactorRequired).toBe(true);
    expect(lg.body.data.pendingToken).toBeTruthy();
    expect(lg.body.data.token).toBeUndefined();

    const bad = await request(app)
      .post('/auth/login/2fa')
      .send({ pendingToken: lg.body.data.pendingToken, code: '999999' });
    expect(bad.status).toBe(401);

    const ok = await request(app)
      .post('/auth/login/2fa')
      .send({ pendingToken: lg.body.data.pendingToken, code: ctx.auth.totpCode(ctx.secret) });
    expect(ok.status).toBe(200);
    expect(ok.body.data.token).toBeTruthy();

    const authed = await request(app)
      .get('/v1/webhooks')
      .set({ Authorization: 'Bearer ' + ok.body.data.token });
    expect(authed.status).toBe(200);
    console.log('P46 S2 OK — interjection + completion + real session');
  }, 60000);

  it('S3: disable restores direct login', async () => {
    const dis = await request(app)
      .post('/auth/2fa/disable')
      .set(ctx.H())
      .send({ code: ctx.auth.totpCode(ctx.secret) });
    expect(dis.status).toBe(200);
    expect(dis.body.data.enabled).toBe(false);

    const lg = await request(app).post('/auth/login').send(creds);
    expect(lg.body.data.token).toBeTruthy();
    expect(lg.body.data.twoFactorRequired).toBeUndefined();
    console.log('P46 S3 OK — full cycle');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
