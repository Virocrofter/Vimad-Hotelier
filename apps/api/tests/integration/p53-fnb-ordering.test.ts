/* P53 — F3 QR order-and-pay: menu from the catalog, order totals exact,
 * status machine + refund guards. Payment initiation/verification/refund
 * carry full code paths; their LIVE legs are key-gated like E2x (no network
 * in tests) — the suite proves everything else.
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
  const mkUser = async (role: string) => {
    const email = `fn-${role}-${runId}@example.com`;
    const password = 'fn-evidence-1234';
    await request(app)
      .post('/v1/users')
      .set(H)
      .send({ email, firstName: 'FN', lastName: role, password, role });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.staffToken = await mkUser('staff');
  ctx.staff = () => ({ Authorization: 'Bearer ' + ctx.staffToken });

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'FN',
      code: ('FN' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const mkItem = (name: string, price: number, status = 'active', category = 'food') =>
    prisma.upsellProduct.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: ctx.prop.id,
        name,
        price,
        status,
        category,
      },
    });
  ctx.burger = await mkItem('Burger', 85);
  ctx.water = await mkItem('Still water', 25, 'active', 'beverage');
  ctx.offItem = await mkItem('Off item', 10, 'inactive');
  console.log('P53 seeded');
}, 90000);

describe('P53 F&B ordering (F3)', () => {
  it('S1: menu lists active catalog items only', async () => {
    const r = await request(app).get(`/v1/fnb/menu/${ctx.prop.code}`);
    expect(r.status).toBe(200);
    const names = r.body.data.items.map((i: any) => i.name);
    expect(names).toContain('Burger');
    expect(names).toContain('Still water');
    expect(names).not.toContain('Off item');
    expect(r.body.data.property.code).toBe(ctx.prop.code);

    const missing = await request(app).get('/v1/fnb/menu/NOPE-CODE');
    expect(missing.status).toBe(404);
    console.log('P53 S1 OK — menu is the active catalog');
  }, 60000);

  it('S2: order totals exact; invalid items rejected', async () => {
    const ok = await request(app)
      .post(`/v1/fnb/orders/${ctx.prop.code}`)
      .send({
        items: [
          { productId: ctx.burger.id, quantity: 2 },
          { productId: ctx.water.id, quantity: 1 },
        ],
        email: `guest-${runId}@example.com`,
        tableLabel: 'Pool deck',
      });
    expect(ok.status).toBe(201);
    expect(ok.body.data.amount).toBe(195);
    expect(ok.body.data.amountMinor).toBe(19500);
    expect(ok.body.data.reference).toMatch(/^FNB-/);
    ctx.orderId = ok.body.data.orderId;
    ctx.reference = ok.body.data.reference;

    const badItem = await request(app)
      .post(`/v1/fnb/orders/${ctx.prop.code}`)
      .send({ items: [{ productId: ctx.offItem.id, quantity: 1 }] });
    expect(badItem.status).toBe(400);

    const ghost = await request(app)
      .post(`/v1/fnb/orders/${ctx.prop.code}`)
      .send({ items: [{ productId: 'nope', quantity: 1 }] });
    expect(ghost.status).toBe(400);
    console.log('P53 S2 OK — totals exact, guards hold');
  }, 60000);

  it('S3: status machine — pay gate, prep flow, cancel guards', async () => {
    const early = await request(app)
      .post(`/v1/fnb/staff/orders/${ctx.orderId}/status`)
      .set(ctx.staff())
      .send({ status: 'preparing' });
    expect(early.status).toBe(409);

    await prisma.fnBOrder.update({ where: { id: ctx.orderId }, data: { status: 'paid' } });

    const prep = await request(app)
      .post(`/v1/fnb/staff/orders/${ctx.orderId}/status`)
      .set(ctx.staff())
      .send({ status: 'preparing' });
    expect(prep.status).toBe(200);
    expect(prep.body.data.status).toBe('preparing');

    const served = await request(app)
      .post(`/v1/fnb/staff/orders/${ctx.orderId}/status`)
      .set(ctx.staff())
      .send({ status: 'served' });
    expect(served.status).toBe(200);

    const late = await request(app)
      .post(`/v1/fnb/staff/orders/${ctx.orderId}/status`)
      .set(ctx.staff())
      .send({ status: 'cancelled' });
    expect(late.status).toBe(409);

    const queue = await request(app).get(`/v1/fnb/staff/orders?status=served`).set(ctx.staff());
    expect(queue.body.data.some((o: any) => o.id === ctx.orderId)).toBe(true);
    console.log('P53 S3 OK — status machine exact');
  }, 60000);

  it('S4: refund guards — unpaid blocked, missing gateway id blocked, scoping', async () => {
    const pending = await request(app)
      .post(`/v1/fnb/orders/${ctx.prop.code}`)
      .send({ items: [{ productId: ctx.water.id, quantity: 1 }] });
    const pendingRefund = await request(app)
      .post(`/v1/fnb/staff/orders/${pending.body.data.orderId}/refund`)
      .set(ctx.staff())
      .send({ reason: 'test' });
    expect(pendingRefund.status).toBe(409);

    await prisma.fnBOrder.update({
      where: { id: pending.body.data.orderId },
      data: { status: 'paid' },
    });
    const noGateway = await request(app)
      .post(`/v1/fnb/staff/orders/${pending.body.data.orderId}/refund`)
      .set(ctx.staff())
      .send({ reason: 'test' });
    expect(noGateway.status).toBe(409);
    expect(noGateway.body.error.code).toBe('NOT_REFUNDABLE');

    const foreign = await request(app)
      .get(`/v1/fnb/staff/orders`)
      .set({ Authorization: 'Bearer someone-else' });
    expect([401, 403]).toContain(foreign.status);
    console.log('P53 S4 OK — refund guards + scoping');
  }, 60000);

  it('S5: recall bounces a served order back to the pass (F4)', async () => {
    const recall = await request(app)
      .post(`/v1/fnb/staff/orders/${ctx.orderId}/status`)
      .set(ctx.staff())
      .send({ status: 'preparing' });
    expect(recall.status).toBe(200);
    expect(recall.body.data.status).toBe('preparing');

    const back = await request(app)
      .post(`/v1/fnb/staff/orders/${ctx.orderId}/status`)
      .set(ctx.staff())
      .send({ status: 'served' });
    expect(back.status).toBe(200);

    const queue = await request(app).get('/v1/fnb/staff/orders?status=preparing').set(ctx.staff());
    expect(queue.body.data.some((o: any) => o.id === ctx.orderId)).toBe(false);
    const servedQ = await request(app).get('/v1/fnb/staff/orders?status=served').set(ctx.staff());
    expect(servedQ.body.data.some((o: any) => o.id === ctx.orderId)).toBe(true);
    console.log('P53 S5 OK — recall + board membership');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
