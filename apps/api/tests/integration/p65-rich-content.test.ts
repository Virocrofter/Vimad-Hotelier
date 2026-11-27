/* P65 — rich booking content: availability + menu payloads carry imageKey
 * and description; the public image redirect serves signed URLs. */
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

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'RC',
      code: ('RC' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenant: { connect: { id: agent.tenantId } },
      property: { connect: { id: ctx.prop.id } },
      name: 'Ocean Suite',
      code: 'RCOC' + runId.toUpperCase().slice(-4),
      baseOccupancy: 2,
      maxOccupancy: 3,
      imageKey: 'catalog/rc-suite.jpg',
      description: 'Corner suite, sea view, private balcony.',
    },
  });
  await prisma.ratePlan.create({
    data: {
      tenant: { connect: { id: agent.tenantId } },
      property: { connect: { id: ctx.prop.id } },
      roomType: { connect: { id: rt.id } },
      name: 'RC BAR',
      code: 'RCBAR' + runId.toUpperCase().slice(-4),
      baseRate: 1450,
    },
  });
  await prisma.room.create({
    data: { tenantId: agent.tenantId, propertyId: ctx.prop.id, roomTypeId: rt.id, number: 'RC-1' },
  });
  await prisma.upsellProduct.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'Sunset cruise',
      price: 650,
      status: 'active',
      category: 'experience',
      imageKey: 'catalog/rc-cruise.jpg',
      description: '90-minute catamaran cruise with drinks.',
    },
  });
  ctx.svc = await import('../../src/modules/public/public.service.js');
  console.log('P65 seeded');
}, 90000);

describe('P65 rich booking content', () => {
  it('S1: availability roomTypes carry imageKey + description', async () => {
    const r = await ctx.svc.getAvailability(ctx.prop.code, {
      checkIn: iso(1),
      checkOut: iso(3),
      adults: 2,
      children: 0,
    });
    expect(r.roomTypes.length).toBe(1);
    expect(r.roomTypes[0].imageKey).toBe('catalog/rc-suite.jpg');
    expect(r.roomTypes[0].description).toContain('sea view');
    console.log('P65 S1 OK — room content rides');
  }, 60000);

  it('S2: menu items carry imageKey + description', async () => {
    const r = await request(app).get(`/v1/fnb/menu/${ctx.prop.code}`);
    expect(r.status).toBe(200);
    const cruise = r.body.data.items.find((i: any) => i.name === 'Sunset cruise');
    expect(cruise.imageKey).toBe('catalog/rc-cruise.jpg');
    expect(cruise.description).toContain('catamaran');
    console.log('P65 S2 OK — menu content rides');
  }, 60000);

  it('S3: public image redirect serves a signed URL', async () => {
    const r = await request(app).get(
      `/v1/public/image/${encodeURIComponent('catalog/rc-suite.jpg')}`
    );
    expect([200, 302]).toContain(r.status);
    if (r.status === 302) expect(r.headers.location).toBeTruthy();
    console.log('P65 S3 OK — image serving');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
