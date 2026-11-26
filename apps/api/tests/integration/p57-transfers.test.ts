/* P57 — O1 hotel-wide stores: inter-outlet transfers as paired ledger
 * movements with an audit record; overdraw/cross-tenant/same-item guards. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

const onHand = async (id: string) => {
  const agg = await prisma.stockMovement.aggregate({
    where: { stockItemId: id },
    _sum: { quantityDelta: true },
  });
  return Number(agg._sum.quantityDelta ?? 0);
};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  const H = { Authorization: 'Bearer ' + agent.token };
  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string) => {
    const email = `tr-${role}-${runId}@example.com`;
    const password = 'tr-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'TR',
      lastName: role,
      password,
      role,
    });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.staffToken = await mkUser('staff');
  ctx.staff = () => ({ Authorization: 'Bearer ' + ctx.staffToken });

  ctx.barProp = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'TR Bar',
      code: ('TRB' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.kitchenProp = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'TR Kitchen',
      code: ('TRK' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.other = await mod.registerTestAgent(app);

  ctx.barGin = await prisma.stockItem.create({
    data: { tenantId: agent.tenantId, propertyId: ctx.barProp.id, name: 'Gin (bar)', unit: 'L' },
  });
  ctx.kitchenGin = await prisma.stockItem.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.kitchenProp.id,
      name: 'Gin (kitchen)',
      unit: 'L',
    },
  });
  await request(app)
    .post(`/v1/stock/items/${ctx.barGin.id}/adjust`)
    .set(ctx.staff())
    .send({ kind: 'purchase', quantityDelta: 10 });
  console.log('P57 seeded');
}, 90000);

describe('P57 hotel-wide transfers (O1)', () => {
  it('S1: transfer moves stock between outlets exactly', async () => {
    const r = await request(app).post('/v1/stock/transfer').set(ctx.staff()).send({
      fromItemId: ctx.barGin.id,
      toItemId: ctx.kitchenGin.id,
      quantity: 4,
      note: 'Cooking stock',
    });
    expect(r.status).toBe(201);
    ctx.transferId = r.body.data.transfer.id;

    expect(await onHand(ctx.barGin.id)).toBe(6);
    expect(await onHand(ctx.kitchenGin.id)).toBe(4);
    console.log('P57 S1 OK — paired movement');
  }, 60000);

  it('S2: guards — overdraw, same item, non-positive', async () => {
    const over = await request(app)
      .post('/v1/stock/transfer')
      .set(ctx.staff())
      .send({ fromItemId: ctx.barGin.id, toItemId: ctx.kitchenGin.id, quantity: 100 });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('OVERDRAW');

    const same = await request(app)
      .post('/v1/stock/transfer')
      .set(ctx.staff())
      .send({ fromItemId: ctx.barGin.id, toItemId: ctx.barGin.id, quantity: 1 });
    expect(same.status).toBe(400);

    const zero = await request(app)
      .post('/v1/stock/transfer')
      .set(ctx.staff())
      .send({ fromItemId: ctx.barGin.id, toItemId: ctx.kitchenGin.id, quantity: 0 });
    expect(zero.status).toBe(400);
    console.log('P57 S2 OK — guards');
  }, 60000);

  it('S3: both ledgers show the linked transfer', async () => {
    const barMoves = await request(app)
      .get(`/v1/stock/items/${ctx.barGin.id}/movements`)
      .set(ctx.staff());
    const out = barMoves.body.data.find((m: any) => m.kind === 'transfer_out');
    expect(out).toBeTruthy();
    expect(out.sourceId).toBe(ctx.transferId);

    const kitchenMoves = await request(app)
      .get(`/v1/stock/items/${ctx.kitchenGin.id}/movements`)
      .set(ctx.staff());
    const inn = kitchenMoves.body.data.find((m: any) => m.kind === 'transfer_in');
    expect(inn.sourceId).toBe(ctx.transferId);

    const list = await request(app).get('/v1/stock/transfers').set(ctx.staff());
    expect(list.body.data[0].id).toBe(ctx.transferId);
    expect(list.body.data[0].fromName).toBe('Gin (bar)');
    expect(list.body.data[0].toName).toBe('Gin (kitchen)');
    console.log('P57 S3 OK — audit trail');
  }, 60000);

  it('S4: cross-tenant items are not transferable', async () => {
    const foreignItem = await prisma.stockItem.create({
      data: {
        tenantId: ctx.other.tenantId,
        propertyId: (
          await prisma.property.create({
            data: {
              tenantId: ctx.other.tenantId,
              name: 'TRF',
              code: ('TRF' + runId)
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(-12),
            },
          })
        ).id,
        name: 'Foreign tonic',
        unit: 'L',
      },
    });
    const r = await request(app)
      .post('/v1/stock/transfer')
      .set(ctx.staff())
      .send({ fromItemId: ctx.barGin.id, toItemId: foreignItem.id, quantity: 1 });
    expect(r.status).toBe(404);
    console.log('P57 S4 OK — tenant scoping');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
