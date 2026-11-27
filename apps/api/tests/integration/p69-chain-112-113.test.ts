/* P69 — 11.3 cross-sell: sister properties surfaced when sold out (chain
 * only, cheapest-first); 11.2: chain templates CRUD + audited rate push
 * (idempotent by code, chain membership enforced). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
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
    const email = `cs-${role}-${runId}@example.com`;
    const password = 'cs-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'CS',
      lastName: role,
      password,
      role,
    });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.ownerToken = await mkUser('owner');
  ctx.owner = () => ({ Authorization: 'Bearer ' + ctx.ownerToken });

  ctx.chain = await prisma.chain.create({
    data: {
      tenantId: agent.tenantId,
      name: 'Group ' + runId,
      slug: 'group-' + runId.toLowerCase(),
    },
  });
  const mkProp = (name: string, chainId: string | null, withRoom: boolean, rate: number) =>
    (async () => {
      const prop = await prisma.property.create({
        data: {
          tenantId: agent.tenantId,
          name,
          code: (name + runId)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(-12),
          chainId,
        },
      });
      const rt = await prisma.roomType.create({
        data: {
          tenant: { connect: { id: agent.tenantId } },
          property: { connect: { id: prop.id } },
          name: `${name} RT`,
          code: (name + 'RT' + runId)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(-12),
        },
      });
      if (withRoom) {
        await prisma.room.create({
          data: {
            tenantId: agent.tenantId,
            propertyId: prop.id,
            roomTypeId: rt.id,
            number: name + '-1',
          },
        });
        await prisma.ratePlan.create({
          data: {
            tenant: { connect: { id: agent.tenantId } },
            property: { connect: { id: prop.id } },
            roomType: { connect: { id: rt.id } },
            name: `${name} BAR`,
            code: (name + 'BAR' + runId)
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(-12),
            baseRate: rate,
          },
        });
      }
      return prop;
    })();
  ctx.propA = await mkProp('CSA', ctx.chain.id, false, 0); // sold out (no rooms)
  ctx.propB = await mkProp('CSB', ctx.chain.id, true, 1100);
  ctx.propC = await mkProp('CSC', null, true, 900); // not in chain
  console.log('P69 seeded');
}, 90000);

describe('P69 chain 11.3 + 11.2', () => {
  it('S1: sold-out property surfaces in-chain sisters with availability', async () => {
    const r = await request(app).get(
      `/v1/public/chain/${ctx.propA.code}/sisters?checkIn=${iso(1)}&checkOut=${iso(3)}&adults=2`
    );
    expect(r.status).toBe(200);
    expect(r.body.data.sisters.length).toBe(1);
    expect(r.body.data.sisters[0].code).toBe(ctx.propB.code);
    expect(r.body.data.sisters[0].cheapestTotal).toBe(2200);

    const solo = await request(app).get(
      `/v1/public/chain/${ctx.propC.code}/sisters?checkIn=${iso(1)}&checkOut=${iso(3)}&adults=2`
    );
    expect(solo.body.data.sisters).toEqual([]); // no chain → no cross-sell
    console.log('P69 S1 OK — cross-sell surfaces sisters only');
  }, 60000);

  it('S2: template CRUD; non-rate push refused honestly', async () => {
    const rate = await request(app)
      .post(`/v1/chains/${ctx.chain.id}/templates`)
      .set(ctx.owner())
      .send({
        name: 'Group BAR',
        type: 'rate',
        payload: { name: 'Group BAR', codePrefix: 'GBAR', baseRate: 1250 },
      });
    expect(rate.status).toBe(201);
    ctx.rateTpl = rate.body.data.id;

    const msgs = await request(app)
      .post(`/v1/chains/${ctx.chain.id}/templates`)
      .set(ctx.owner())
      .send({
        name: 'Welcome message',
        type: 'messages',
        payload: { subject: 'See you soon', body: '…' },
      });
    expect(msgs.status).toBe(201);
    ctx.msgTpl = msgs.body.data.id;

    const list = await request(app).get(`/v1/chains/${ctx.chain.id}/templates`).set(ctx.owner());
    expect(list.body.data.length).toBe(2);

    const nope = await request(app)
      .post(`/v1/chains/${ctx.chain.id}/templates/${ctx.msgTpl}/push`)
      .set(ctx.owner())
      .send({ propertyIds: [ctx.propB.id] });
    expect(nope.status).toBe(409);
    expect(nope.body.error.code).toBe('NOT_PUSHABLE');
    console.log('P69 S2 OK — CRUD + honest refusal');
  }, 60000);

  it('S3: rate push applies one plan per room type, idempotent; chain enforced', async () => {
    const push = await request(app)
      .post(`/v1/chains/${ctx.chain.id}/templates/${ctx.rateTpl}/push`)
      .set(ctx.owner())
      .send({ propertyIds: [ctx.propB.id] });
    expect(push.status).toBe(200);
    expect(push.body.data.applied.length).toBe(1);
    expect(push.body.data.applied[0].skipped).toBe(false);

    const again = await request(app)
      .post(`/v1/chains/${ctx.chain.id}/templates/${ctx.rateTpl}/push`)
      .set(ctx.owner())
      .send({ propertyIds: [ctx.propB.id] });
    expect(again.body.data.applied[0].skipped).toBe(true);

    const plans = await prisma.ratePlan.findMany({
      where: { tenantId: ctx.tenantId, code: { startsWith: 'GBAR-' } },
    });
    expect(plans.length).toBe(1);
    expect(Number(plans[0].baseRate)).toBe(1250);

    const outsider = await request(app)
      .post(`/v1/chains/${ctx.chain.id}/templates/${ctx.rateTpl}/push`)
      .set(ctx.owner())
      .send({ propertyIds: [ctx.propC.id] });
    expect(outsider.status).toBe(400);
    console.log('P69 S3 OK — push audited + idempotent + chain-enforced');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
