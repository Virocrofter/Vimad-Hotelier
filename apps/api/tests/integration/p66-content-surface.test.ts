/* P66 — staff content surface: catalog image upload (format guard), content
 * patches on room types + products reflected in reads, tenant scoping. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  const H = { Authorization: 'Bearer ' + agent.token };
  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string) => {
    const email = `ct-${role}-${runId}@example.com`;
    const password = 'ct-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'CT',
      lastName: role,
      password,
      role,
    });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.ownerToken = await mkUser('owner');
  ctx.other = await mod.registerTestAgent(app);
  ctx.owner = () => ({ Authorization: 'Bearer ' + ctx.ownerToken });

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'CT',
      code: ('CT' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.rt = await prisma.roomType.create({
    data: {
      tenant: { connect: { id: agent.tenantId } },
      property: { connect: { id: ctx.prop.id } },
      name: 'Garden Room',
      code: 'CTRT' + runId.toUpperCase().slice(-4),
    },
  });
  ctx.item = await prisma.upsellProduct.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'Breakfast basket',
      price: 120,
      status: 'active',
      category: 'food',
    },
  });
  console.log('P66 seeded');
}, 90000);

describe('P66 content surface', () => {
  it('S1: image upload returns a catalog key; non-images refused', async () => {
    const up = await request(app)
      .post('/v1/files/images')
      .set(ctx.owner())
      .send({ name: 'suite.png', contentBase64: PNG_B64 });
    expect(up.status).toBe(201);
    expect(up.body.data.key).toMatch(new RegExp(`^catalog/${ctx.tenantId}/.+\\.png$`));
    ctx.imageKey = up.body.data.key;

    const bad = await request(app)
      .post('/v1/files/images')
      .set(ctx.owner())
      .send({ name: 'evil.exe', contentBase64: PNG_B64 });
    expect(bad.status).toBe(400);
    console.log('P66 S1 OK — upload + guard');
  }, 60000);

  it('S2: room type + item content patches reflect in reads', async () => {
    const rt = await request(app)
      .patch(`/v1/content/room-types/${ctx.rt.id}`)
      .set(ctx.owner())
      .send({ imageKey: ctx.imageKey, description: 'Ground floor, garden access.' });
    expect(rt.status).toBe(200);

    const up = await request(app)
      .patch(`/v1/content/upsell-products/${ctx.item.id}`)
      .set(ctx.owner())
      .send({ description: 'Local pastries + filter coffee.', price: 145 });
    expect(up.status).toBe(200);
    expect(up.body.data.price).toBe(145);

    const rts = await request(app)
      .get(`/v1/content/room-types?propertyId=${ctx.prop.id}`)
      .set(ctx.owner());
    expect(rts.body.data[0].description).toContain('garden');
    expect(rts.body.data[0].imageKey).toBe(ctx.imageKey);

    const menu = await request(app).get(`/v1/fnb/menu/${ctx.prop.code}`);
    const basket = menu.body.data.items.find((i: any) => i.name === 'Breakfast basket');
    expect(basket.description).toContain('pastries');
    expect(basket.price).toBe(145);
    console.log('P66 S2 OK — content round-trips to the guest surfaces');
  }, 60000);

  it('S3: tenant scoping on patches', async () => {
    const foreign = await request(app)
      .patch(`/v1/content/room-types/${ctx.rt.id}`)
      .set({ Authorization: 'Bearer ' + ctx.other.token })
      .send({ description: 'sneaky' });
    expect([403, 404]).toContain(foreign.status);

    const missing = await request(app)
      .patch('/v1/content/room-types/nope')
      .set(ctx.owner())
      .send({ description: 'x' });
    expect(missing.status).toBe(404);
    console.log('P66 S3 OK — scoping');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
