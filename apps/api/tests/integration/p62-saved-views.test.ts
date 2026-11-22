/* 6.2 — saved views: per-user filter-state snapshots on the BI hub. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'SV',
      code: ('SV' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.propId = prop.id;
  ctx.H = () => ({ Authorization: 'Bearer ' + agent.token });
  console.log('6.2 seeded');
}, 90000);

describe('6.2 saved views', () => {
  it('S1: create -> list (config round-trip) -> delete', async () => {
    const c = await request(app)
      .post('/v1/bi/views')
      .set(ctx.H())
      .send({
        name: 'Morning ' + runId,
        propertyId: ctx.propId,
        config: { propertyId: ctx.propId, families: ['dailySummary'] },
      });
    expect(c.status).toBe(201);

    const list = await request(app).get('/v1/bi/views').set(ctx.H());
    expect(list.status).toBe(200);
    const mine = list.body.data.find((v: any) => v.id === c.body.data.id);
    expect(mine.name).toBe('Morning ' + runId);
    expect(mine.config.propertyId).toBe(ctx.propId);
    expect(mine.config.families).toEqual(['dailySummary']);

    const del = await request(app)
      .delete('/v1/bi/views/' + c.body.data.id)
      .set(ctx.H());
    expect(del.status).toBe(200);
    const after = await request(app).get('/v1/bi/views').set(ctx.H());
    expect(after.body.data.some((v: any) => v.id === c.body.data.id)).toBe(false);
    console.log('6.2 S1 OK — CRUD + config round-trip');
  }, 60000);

  it('S2: name required; unknown id delete is a quiet no-op', async () => {
    const bad = await request(app).post('/v1/bi/views').set(ctx.H()).send({ config: {} });
    expect(bad.status).toBe(400);
    const del = await request(app).delete('/v1/bi/views/does-not-exist').set(ctx.H());
    expect(del.status).toBe(200);
    console.log('6.2 S2 OK — validation + idempotent delete');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
