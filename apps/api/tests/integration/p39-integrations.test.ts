/* P39 — D2 marketplace backend: connect (install + first sync), providers
 * reflect state, sync/test observability, disconnect (status flip), tenant
 * scoping, owner/admin role gate.
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
    const email = `ig-${tag}-${role}-${runId}@example.com`;
    const password = 'ig-evidence-1234';
    await request(app)
      .post('/v1/users')
      .set(H)
      .send({ email, firstName: 'IG', lastName: role, password, role });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  adminToken = await mkUser('owner', 'a');
  staffToken = await mkUser('staff', 's');
  otherAgent = await mod.registerTestAgent(app);
  ctx.admin = () => ({ Authorization: 'Bearer ' + adminToken });
  ctx.staff = () => ({ Authorization: 'Bearer ' + staffToken });
  ctx.other = () => ({ Authorization: 'Bearer ' + otherAgent.token });
  console.log('P39 seeded');
}, 90000);

describe('P39 marketplace (D2)', () => {
  it('S1: connect installs + first-syncs; providers reflect connected state', async () => {
    const c = await request(app)
      .post('/v1/admin/integrations/connect')
      .set(ctx.admin())
      .send({
        provider: 'slack',
        credentials: { apiToken: 'xoxb-test' },
        config: { channel: '#ops' },
      });
    expect(c.status).toBe(201);
    expect(c.body.data.status).toBe('connected');
    expect(c.body.data.lastSyncStatus).toBe('ok');
    expect(c.body.data.lastSyncAt).toBeTruthy();
    ctx.installId = c.body.data.id;

    const providers = await request(app).get('/v1/admin/integrations/providers').set(ctx.admin());
    const slack = providers.body.data.find((p: any) => p.key === 'slack');
    expect(slack.connected?.id).toBe(ctx.installId);

    const connected = await request(app).get('/v1/admin/integrations/connected').set(ctx.admin());
    expect(connected.body.data.some((x: any) => x.id === ctx.installId)).toBe(true);

    const statsRes = await request(app).get('/v1/admin/integrations/stats').set(ctx.admin());
    expect(statsRes.body.data.connected).toBe(1);
    console.log('P39 S1 OK — install-to-first-sync without an engineer');
  }, 60000);

  it('S2: sync + test record observability; unknown provider 404', async () => {
    const sy = await request(app)
      .post('/v1/admin/integrations/sync')
      .set(ctx.admin())
      .send({ id: ctx.installId });
    expect(sy.status).toBe(200);
    expect(sy.body.data.lastSyncAt).toBeTruthy();

    const te = await request(app)
      .post('/v1/admin/integrations/test')
      .set(ctx.admin())
      .send({ id: ctx.installId });
    expect(te.body.data.lastSyncStatus).toBe('ok');

    const bad = await request(app)
      .post('/v1/admin/integrations/connect')
      .set(ctx.admin())
      .send({ provider: 'nope-provider' });
    expect(bad.status).toBe(404);
    console.log('P39 S2 OK — sync/test/observability');
  }, 60000);

  it('S3: disconnect flips status; connect re-uses the row', async () => {
    const d = await request(app)
      .post('/v1/admin/integrations/disconnect')
      .set(ctx.admin())
      .send({ id: ctx.installId });
    expect(d.status).toBe(200);
    expect(d.body.data.status).toBe('disconnected');

    const connected = await request(app).get('/v1/admin/integrations/connected').set(ctx.admin());
    expect(connected.body.data.some((x: any) => x.id === ctx.installId)).toBe(false);

    const again = await request(app)
      .post('/v1/admin/integrations/connect')
      .set(ctx.admin())
      .send({ provider: 'slack', credentials: { apiToken: 'xoxb-rotated' } });
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe(ctx.installId);
    expect(again.body.data.status).toBe('connected');
    console.log(
      'P39 S3 OK — disconnect + reconnect on the same row (credential rotation by reconnect)'
    );
  }, 60000);

  it('S4: tenant scoping + staff role gate', async () => {
    const other = await request(app).get('/v1/admin/integrations/connected').set(ctx.other());
    expect(other.body.data.some((x: any) => x.id === ctx.installId)).toBe(false);
    const foreign = await request(app)
      .post('/v1/admin/integrations/sync')
      .set(ctx.other())
      .send({ id: ctx.installId });
    expect([403, 404]).toContain(foreign.status);

    const staffCreate = await request(app)
      .post('/v1/admin/integrations/connect')
      .set(ctx.staff())
      .send({ provider: 'slack' });
    expect(staffCreate.status).toBe(403);
    console.log('P39 S4 OK — scoping + role gate');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
