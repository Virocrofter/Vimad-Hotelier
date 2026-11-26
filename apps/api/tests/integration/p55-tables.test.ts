/* P55 — F1/F2 venue tables: CRUD + duplicate guard, seat binding with
 * busy/closed/cross-property guards, dining flow, free. */
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
    const email = `tb-${role}-${runId}@example.com`;
    const password = 'tb-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'TB',
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
      name: 'TB',
      code: ('TB' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.other = await mod.registerTestAgent(app);
  ctx.otherH = () => ({ Authorization: 'Bearer ' + ctx.other.token });
  console.log('P55 seeded');
}, 90000);

describe('P55 venue tables (F1/F2)', () => {
  it('S1: create + list + duplicate label guard', async () => {
    const t = await request(app)
      .post('/v1/fnb/tables')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, label: 'T1', area: 'Deck', seats: 4 });
    expect(t.status).toBe(201);
    ctx.tableId = t.body.data.id;

    await request(app)
      .post('/v1/fnb/tables')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, label: 'T2', area: 'Deck', seats: 2 });

    const dup = await request(app)
      .post('/v1/fnb/tables')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, label: 'T1' });
    expect(dup.status).toBe(409);

    const list = await request(app)
      .get(`/v1/fnb/tables?propertyId=${ctx.prop.id}`)
      .set(ctx.staff());
    expect(list.body.data.length).toBe(2);
    expect(list.body.data.every((x: any) => x.status === 'free')).toBe(true);
    console.log('P55 S1 OK — tables + duplicate guard');
  }, 60000);

  it('S2: seat binds an open check; busy/closed guards', async () => {
    const c = await request(app)
      .post('/v1/till/checks')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, label: 'T1 party' });
    ctx.checkId = c.body.data.id;

    const seat = await request(app)
      .post(`/v1/fnb/tables/${ctx.tableId}/seat`)
      .set(ctx.staff())
      .send({ checkId: ctx.checkId });
    expect(seat.status).toBe(200);
    expect(seat.body.data.status).toBe('seated');

    const c2 = await request(app)
      .post('/v1/till/checks')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, label: 'Walk-up' });
    const busy = await request(app)
      .post(`/v1/fnb/tables/${ctx.tableId}/seat`)
      .set(ctx.staff())
      .send({ checkId: c2.body.data.id });
    expect(busy.status).toBe(409);
    expect(busy.body.error.code).toBe('TABLE_BUSY');
    console.log('P55 S2 OK — seat binding + busy guard');
  }, 60000);

  it('S3: dining flow + free', async () => {
    const ord = await request(app)
      .post(`/v1/fnb/tables/${ctx.tableId}/status`)
      .set(ctx.staff())
      .send({ status: 'ordered' });
    expect(ord.body.data.status).toBe('ordered');

    const skip = await request(app)
      .post(`/v1/fnb/tables/${ctx.tableId}/status`)
      .set(ctx.staff())
      .send({ status: 'ordered' });
    expect(skip.status).toBe(409);

    const served = await request(app)
      .post(`/v1/fnb/tables/${ctx.tableId}/status`)
      .set(ctx.staff())
      .send({ status: 'served' });
    expect(served.body.data.status).toBe('served');

    const free = await request(app).post(`/v1/fnb/tables/${ctx.tableId}/free`).set(ctx.staff());
    expect(free.body.data.status).toBe('free');
    expect(free.body.data.checkId).toBeNull();

    const again = await request(app).post(`/v1/fnb/tables/${ctx.tableId}/free`).set(ctx.staff());
    expect(again.status).toBe(409);
    console.log('P55 S3 OK — flow + free + idempotent guard');
  }, 60000);

  it('S4: closed checks cannot be seated; scoping holds', async () => {
    await prisma.tillCheck.update({ where: { id: ctx.checkId }, data: { status: 'closed' } });
    const closed = await request(app)
      .post(`/v1/fnb/tables/${ctx.tableId}/seat`)
      .set(ctx.staff())
      .send({ checkId: ctx.checkId });
    expect(closed.status).toBe(409);

    const foreign = await request(app)
      .get(`/v1/fnb/tables?propertyId=${ctx.prop.id}`)
      .set(ctx.otherH());
    expect(foreign.body.data.length).toBe(0);
    console.log('P55 S4 OK — closed-seat guard + scoping');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
