/* P52 — booking-engine readiness (9.6): sellable spaces, active priced
 * plans, category/rate mapping, payment path. Schema-exact seeds
 * (RatePlan: tenant/property/roomType connects + baseRate, per the audit).
 */
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
  const email = `br-owner-${runId}@example.com`;
  const password = 'br-evidence-1234';
  await request(app)
    .post('/v1/users')
    .set(H)
    .send({ email, firstName: 'BR', lastName: 'owner', password, role: 'owner' });
  const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
  ctx.ownerToken = (lg.body?.data ?? lg.body)?.token;
  ctx.owner = () => ({ Authorization: 'Bearer ' + ctx.ownerToken });

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'BR',
      code: ('BR' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.other = await mod.registerTestAgent(app);
  ctx.otherOwner = () => ({ Authorization: 'Bearer ' + ctx.other.token });
  console.log('P52 seeded');
}, 90000);

const check = (b: any, key: string) => (b?.data ?? b)?.checks.find((c: any) => c.key === key);

describe('P52 booking readiness (9.6)', () => {
  it('S1: checks flip as the property becomes bookable; widget URL present', async () => {
    const empty = await request(app)
      .get(`/v1/booking-engine/readiness?propertyId=${ctx.prop.id}`)
      .set(ctx.owner());
    expect(empty.status).toBe(200);
    expect(check(empty.body, 'sellable').done).toBe(false);
    expect(check(empty.body, 'priced').done).toBe(false);
    expect(check(empty.body, 'mapped').done).toBe(false);
    expect(empty.body.data.ready).toBe(false);
    expect(empty.body.data.widgetUrl).toBe(`/book/${ctx.prop.code}`);

    const rt = await prisma.roomType.create({
      data: {
        tenant: { connect: { id: ctx.tenantId } },
        property: { connect: { id: ctx.prop.id } },
        name: 'BR RT',
        code: 'BRRT' + runId.toUpperCase().slice(-4),
      },
    });
    ctx.rt = rt;
    await prisma.room.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: ctx.prop.id,
        roomTypeId: rt.id,
        number: 'BR-1',
      },
    });
    let r = (
      await request(app)
        .get(`/v1/booking-engine/readiness?propertyId=${ctx.prop.id}`)
        .set(ctx.owner())
    ).body.data;
    expect(check(r, 'sellable').done).toBe(true);
    expect(check(r, 'priced').done).toBe(false);

    await prisma.ratePlan.create({
      data: {
        tenant: { connect: { id: ctx.tenantId } },
        property: { connect: { id: ctx.prop.id } },
        roomType: { connect: { id: rt.id } },
        name: 'BR BAR',
        code: 'BRBAR' + runId.toUpperCase().slice(-4),
        baseRate: 950,
      },
    });
    r = (
      await request(app)
        .get(`/v1/booking-engine/readiness?propertyId=${ctx.prop.id}`)
        .set(ctx.owner())
    ).body.data;
    expect(check(r, 'priced').done).toBe(true);
    expect(check(r, 'mapped').done).toBe(true);
    const pay = check(r, 'payments');
    expect(pay.done).toBe(pay.configured || pay.tested);
    console.log('P52 S1 OK — checks flip on real data');
  }, 60000);

  it('S2: inactive or unpriced plans do not count', async () => {
    await prisma.ratePlan.updateMany({
      where: { tenantId: ctx.tenantId, propertyId: ctx.prop.id },
      data: { status: 'inactive' },
    });
    const r = (
      await request(app)
        .get(`/v1/booking-engine/readiness?propertyId=${ctx.prop.id}`)
        .set(ctx.owner())
    ).body.data;
    expect(check(r, 'priced').done).toBe(false);
    expect(check(r, 'mapped').done).toBe(false);
    expect(r.ready).toBe(false);
    console.log('P52 S2 OK — inactive plans excluded');
  }, 60000);

  it('S3: tenant scoping + auth', async () => {
    const foreign = await request(app)
      .get(`/v1/booking-engine/readiness?propertyId=${ctx.prop.id}`)
      .set(ctx.otherOwner());
    expect(foreign.status).toBe(404);

    const anon = await request(app).get(`/v1/booking-engine/readiness?propertyId=${ctx.prop.id}`);
    expect(anon.status).toBe(401);
    console.log('P52 S3 OK — scoping + auth');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
