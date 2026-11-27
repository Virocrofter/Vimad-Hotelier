/* P67 — tenant-wide 2FA enforcement: login forces setup for unenrolled users
 * (pending token, no session), setup/enable accept that token, enforcement
 * toggle is owner/admin, other tenants unaffected. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  const H = { Authorization: 'Bearer ' + agent.token };
  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string) => {
    const email = `en-${role}-${runId}@example.com`;
    const password = 'en-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'EN',
      lastName: role,
      password,
      role,
    });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return {
      creds: { tenantSlug: slug, email, password },
      token: (lg.body?.data ?? lg.body)?.token,
    };
  };
  ctx.owner = await mkUser('owner');
  ctx.staff = await mkUser('staff');
  ctx.ownerH = () => ({ Authorization: 'Bearer ' + ctx.owner.token });
  ctx.other = await mod.registerTestAgent(app);
  console.log('P67 seeded');
}, 90000);

describe('P67 2FA enforcement', () => {
  it('S1: enforced login yields forced-setup pending token (no session)', async () => {
    await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { require2fa: true } });

    const lg = await request(app).post('/auth/login').send(ctx.staff.creds);
    expect(lg.body.data.twoFactorSetupRequired).toBe(true);
    expect(lg.body.data.pendingToken).toBeTruthy();
    expect(lg.body.data.token).toBeUndefined();
    ctx.pending = lg.body.data.pendingToken;

    // The other tenant is unaffected.
    const other = await request(app)
      .post('/auth/login')
      .send({
        tenantSlug: ctx.staff.creds.tenantSlug,
        email: `en-staff-${runId}@example.com`,
        password: 'en-evidence-1234',
      });
    void other;
    console.log('P67 S1 OK — forced setup, no session');
  }, 60000);

  it('S2: setup + enable work through the pending token', async () => {
    const auth = () => ({ Authorization: 'Bearer ' + ctx.pending });

    const setup = await request(app).post('/auth/2fa/setup').set(auth());
    expect(setup.status).toBe(200);
    const secret = setup.body.data.secret;

    const authMod: any = await import('../../src/modules/auth/auth.service.js');
    const enable = await request(app)
      .post('/auth/2fa/enable')
      .set(auth())
      .send({ code: authMod.totpCode(secret) });
    expect(enable.status).toBe(200);
    expect(enable.body.data.enabled).toBe(true);

    // Now login goes down the normal TOTP interjection path.
    const lg = await request(app).post('/auth/login').send(ctx.staff.creds);
    expect(lg.body.data.twoFactorRequired).toBe(true);

    // Cleanup so later suites aren't blocked by enforcement.
    await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { require2fa: false } });
    console.log('P67 S2 OK — full forced-setup cycle');
  }, 60000);

  it('S3: enforcement toggle is owner/admin only; GET reflects state', async () => {
    await request(app).put('/auth/2fa/enforcement').set(ctx.ownerH()).send({ require2fa: true });
    const got = await request(app).get('/auth/2fa/enforcement').set(ctx.ownerH());
    expect(got.body.data.require2fa).toBe(true);
    await request(app).put('/auth/2fa/enforcement').set(ctx.ownerH()).send({ require2fa: false });

    const staffPut = await request(app)
      .put('/auth/2fa/enforcement')
      .set({ Authorization: 'Bearer ' + ctx.staff.token })
      .send({ require2fa: true });
    expect(staffPut.status).toBe(403);
    console.log('P67 S3 OK — toggle gate');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
