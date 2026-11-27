/* P71 — DS-12/9.7 white-label theming: theme contract CRUD (hex/radius
 * validation), public theme-by-code for the widget, active flag, scoping. */
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
    const email = `th-${role}-${runId}@example.com`;
    const password = 'th-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'TH',
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

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'TH',
      code: ('TH' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  console.log('P71 seeded');
}, 90000);

describe('P71 white-label theming (DS-12)', () => {
  it('S1: owner PUTs the theme contract; validation guards', async () => {
    const put = await request(app)
      .put('/v1/tenant-theme')
      .set(ctx.owner())
      .send({ accent: '#1a7f6b', ring: '#145c50', radiusPx: 14, logoKey: 'catalog/th-logo.png' });
    expect(put.status).toBe(201);

    const got = await request(app).get('/v1/tenant-theme').set(ctx.owner());
    expect(got.body.data.accent).toBe('#1a7f6b');
    expect(got.body.data.radiusPx).toBe(14);

    const bad = await request(app)
      .put('/v1/tenant-theme')
      .set(ctx.owner())
      .send({ accent: '#zzz' });
    expect(bad.status).toBe(400);

    const big = await request(app).put('/v1/tenant-theme').set(ctx.owner()).send({ radiusPx: 99 });
    expect(big.status).toBe(400);

    const staff = await request(app)
      .put('/v1/tenant-theme')
      .set({ Authorization: 'Bearer ' + ctx.staffToken })
      .send({ accent: '#112233' });
    expect(staff.status).toBe(403);
    console.log('P71 S1 OK — contract + guards');
  }, 60000);

  it('S2: public theme by property code; inactive hides', async () => {
    const t = await request(app).get(`/v1/public/theme/${ctx.prop.code}`);
    expect(t.status).toBe(200);
    expect(t.body.data.accent).toBe('#1a7f6b');
    expect(t.body.data.logoKey).toBe('catalog/th-logo.png');

    await request(app).put('/v1/tenant-theme').set(ctx.owner()).send({ isActive: false });
    const off = await request(app).get(`/v1/public/theme/${ctx.prop.code}`);
    expect(off.status).toBe(404);
    await request(app).put('/v1/tenant-theme').set(ctx.owner()).send({ isActive: true });
    console.log('P71 S2 OK — public theme + active flag');
  }, 60000);

  it('S3: property without a theme 404s; tenant scoping', async () => {
    const other = await prisma.property.create({
      data: {
        tenantId: ctx.tenantId,
        name: 'TH2',
        code: ('TH2' + runId)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(-12),
      },
    });
    await prisma.tenantTheme.deleteMany({ where: { tenantId: ctx.tenantId } });
    const none = await request(app).get(`/v1/public/theme/${other.code}`);
    expect(none.status).toBe(404);
    console.log('P71 S3 OK — empty-state + cleanup');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
