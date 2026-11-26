/* P56 — F6 stock ledger + recipes: derived quantities, purchase/waste
 * movements, till-close deduction through the BOM, refund restock, and the
 * F9 item-performance feed over real sales. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

vi.mock('../../src/common/paystack.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    // The refund's gateway leg is key-gated (live). Stub it so the suite
    // exercises the restock hook that runs after a successful refund.
    createRefund: async () => ({ refundId: 'test-refund-' + Date.now() }),
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
  const H = { Authorization: 'Bearer ' + agent.token };
  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string) => {
    const email = `sk-${role}-${runId}@example.com`;
    const password = 'sk-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'SK',
      lastName: role,
      password,
      role,
    });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.staffToken = await mkUser('staff');
  ctx.staff = () => ({ Authorization: 'Bearer ' + ctx.staffToken });

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'SK',
      code: ('SK' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });

  ctx.meat = await prisma.stockItem.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'Burger patties',
      unit: 'ea',
      parLevel: 10,
      costPerUnit: 18,
    },
  });
  ctx.bun = await prisma.stockItem.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'Brioche buns',
      unit: 'ea',
      parLevel: 12,
    },
  });

  ctx.burger = await prisma.upsellProduct.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'Classic burger',
      price: 95,
      status: 'active',
      category: 'food',
    },
  });

  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'SK', lastName: 'Guest' },
  });
  ctx.res = await prisma.reservation.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      guestId: guest.id,
      confirmationNumber: 'SK' + runId.toUpperCase().slice(-6),
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
      tenantId: agent.tenantId,
      reservationId: ctx.res.id,
      totalCharges: 0,
      totalPayments: 0,
      balance: 0,
    },
  });
  console.log('P56 seeded');
}, 90000);

const onHand = async (id: string) => {
  const agg = await prisma.stockMovement.aggregate({
    where: { stockItemId: id },
    _sum: { quantityDelta: true },
  });
  return Number(agg._sum.quantityDelta ?? 0);
};

describe('P56 stock + recipes (F6/F9)', () => {
  it('S1: purchases/waste move the derived quantity; low-stock flags', async () => {
    const buy = await request(app)
      .post(`/v1/stock/items/${ctx.meat.id}/adjust`)
      .set(ctx.staff())
      .send({ kind: 'purchase', quantityDelta: 30, unitCost: 18, note: 'Supplier drop' });
    expect(buy.status).toBe(201);

    await request(app)
      .post(`/v1/stock/items/${ctx.bun.id}/adjust`)
      .set(ctx.staff())
      .send({ kind: 'purchase', quantityDelta: 24 });

    expect(await onHand(ctx.meat.id)).toBe(30);
    expect(await onHand(ctx.bun.id)).toBe(24);

    const waste = await request(app)
      .post(`/v1/stock/items/${ctx.meat.id}/adjust`)
      .set(ctx.staff())
      .send({ kind: 'waste', quantityDelta: -21, note: 'Freezer burn' });
    expect(waste.status).toBe(201);
    expect(await onHand(ctx.meat.id)).toBe(9);

    const items = await request(app)
      .get(`/v1/stock/items?propertyId=${ctx.prop.id}`)
      .set(ctx.staff());
    const meat = items.body.data.find((i: any) => i.id === ctx.meat.id);
    expect(meat.onHand).toBe(9);
    expect(meat.low).toBe(true);
    const bun = items.body.data.find((i: any) => i.id === ctx.bun.id);
    expect(bun.low).toBe(false);

    const neg = await request(app)
      .post(`/v1/stock/items/${ctx.meat.id}/adjust`)
      .set(ctx.staff())
      .send({ kind: 'purchase', quantityDelta: -5 });
    expect(neg.status).toBe(400);
    console.log('P56 S1 OK — ledger + low-stock');
  }, 60000);

  it('S2: recipe BOM deducts on till close', async () => {
    const recipe = await request(app)
      .post('/v1/stock/recipes')
      .set(ctx.staff())
      .send({
        propertyId: ctx.prop.id,
        name: 'Classic burger build',
        productId: ctx.burger.id,
        ingredients: [
          { stockItemId: ctx.meat.id, quantity: 1 },
          { stockItemId: ctx.bun.id, quantity: 1 },
        ],
      });
    expect(recipe.status).toBe(201);
    ctx.recipeId = recipe.body.data.id;

    const check = await request(app)
      .post('/v1/till/checks')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, label: 'Table 9' });
    ctx.checkId = check.body.data.id;

    await request(app)
      .post(`/v1/till/checks/${ctx.checkId}/items`)
      .set(ctx.staff())
      .send({ productId: ctx.burger.id, quantity: 2 });

    const close = await request(app)
      .post(`/v1/till/checks/${ctx.checkId}/close`)
      .set(ctx.staff())
      .send({ payments: [{ method: 'cash', amountMinor: 19000 }] });
    expect(close.status).toBe(200);

    expect(await onHand(ctx.meat.id)).toBe(7);
    expect(await onHand(ctx.bun.id)).toBe(22);

    const moves = await request(app)
      .get(`/v1/stock/items/${ctx.meat.id}/movements`)
      .set(ctx.staff());
    expect(
      moves.body.data.some((m: any) => m.kind === 'usage' && m.sourceType === 'till_check')
    ).toBe(true);
    console.log('P56 S2 OK — BOM deduction at close');
  }, 60000);

  it('S3: F3 order deducts at settle; refund restocks', async () => {
    const order = await request(app)
      .post(`/v1/fnb/orders/${ctx.prop.code}`)
      .send({
        items: [{ productId: ctx.burger.id, quantity: 1 }],
        email: `sk-${runId}@example.com`,
      });
    expect(order.status).toBe(201);
    ctx.orderId = order.body.data.orderId;

    const svc = await import('../../src/modules/fnb/fnb.service.js');
    const settled = await svc.claimPaid(ctx.orderId, BigInt(999001));
    expect(settled?.status).toBe('paid');
    expect(await onHand(ctx.meat.id)).toBe(6);

    const refund = await request(app)
      .post(`/v1/fnb/staff/orders/${ctx.orderId}/refund`)
      .set(ctx.staff())
      .send({ reason: 'Guest changed mind' });
    expect(refund.status).toBe(200);
    expect(await onHand(ctx.meat.id)).toBe(7);
    console.log('P56 S3 OK — F3 deduct + refund restock');
  }, 60000);

  it('S4: F9 item performance ranks real sales', async () => {
    const perf = await request(app)
      .get(`/v1/stock/performance?propertyId=${ctx.prop.id}`)
      .set(ctx.staff());
    expect(perf.status).toBe(200);
    const burger = perf.body.data.find((x: any) => x.productId === ctx.burger.id);
    // Net of the S3 refund: 2 sold, R190 revenue (the refunded order left).
    expect(burger.qty).toBe(2);
    expect(burger.revenue).toBe(190);
    expect(perf.body.data[0].productId).toBe(ctx.burger.id);
    console.log('P56 S4 OK — performance feed ranks sales');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
