/* 6.4 — Daily Briefing: rules-generated, legible, zero hallucination. */
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
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'BR',
      code: ('BR' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'BR RT',
      code: 'BRRT' + runId.toUpperCase().slice(-4),
    },
  });
  await prisma.room.create({
    data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: 'BR-1' },
  });
  await prisma.room.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      roomTypeId: rt.id,
      number: 'BR-2',
      serviceStatus: 'oos',
    },
  });
  const g = await prisma.guest.create({
    data: { tenantId: t, firstName: 'BR', lastName: 'Guest', email: `br-${runId}@example.com` },
  });
  const today = new Date().toISOString().slice(0, 10);
  await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: g.id,
      confirmationNumber: 'BRUNPAID' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(today),
      departureDate: new Date(Date.now() + 2 * 86400_000),
      nights: 2,
      totalAmount: 2000,
      balance: 500,
    },
  });
  ctx.t = t;
  ctx.propId = prop.id;
  console.log('6.4 seeded');
}, 90000);

describe('6.4 daily briefing', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });

  it('S1: sentences are rules-generated, cite real numbers, and explain themselves', async () => {
    const r = await request(app)
      .get('/v1/bi/briefing?propertyId=' + ctx.propId)
      .set(H());
    expect(r.status).toBe(200);
    const sents = r.body.data.sentences;
    expect(sents.length).toBeGreaterThanOrEqual(6);
    for (const s of sents) {
      expect(s.rule).toBeTruthy();
      expect(s.text).toBeTruthy();
      expect(typeof s.data).toBe('object'); // every sentence carries the numbers it cites
    }
    const unpaid = sents.find((s: any) => s.rule === 'unpaid');
    expect(unpaid.text).toContain('1');
    expect(unpaid.kind).toBe('warning');
    const blocked = sents.find((s: any) => s.rule === 'blocked');
    expect(blocked.text).toContain('1');
    const pickup = sents.find((s: any) => s.rule === 'pickup');
    expect(pickup.text).toMatch(/Pickup [+-]?\d+/);
    console.log('6.4 S1 OK — legible, cited, rules-generated');
  }, 60000);

  it('S2: property scoping holds (empty property, brief neutral sentences)', async () => {
    const other = await prisma.property.create({
      data: { tenantId: ctx.t, name: 'BR2', code: ('BR2' + runId).toUpperCase().slice(-12) },
    });
    const r = await request(app)
      .get('/v1/bi/briefing?propertyId=' + other.id)
      .set(H());
    expect(r.status).toBe(200);
    const unpaid = r.body.data.sentences.find((s: any) => s.rule === 'unpaid');
    expect(unpaid.text).toContain('settled');
    console.log('6.4 S2 OK — scoping');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
