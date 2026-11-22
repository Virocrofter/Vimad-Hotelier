/* C8′ — Google Hotel Ads free-booking-links attribution (build half).
 * S1: a booking carrying utm_source=google + utm_medium=hotel_ads is
 *     recorded with source google_hotel_ads.
 * S2: an organic booking records source direct.
 * S3: GET /v1/reservations/attribution groups bookings by source with
 *     counts and revenue (tracking fires; attribution visible).
 * (Google-side verification — Business Profile + Hotel Center — is the
 * external half, tracked separately.)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

vi.mock('../../src/common/paystack.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    initializeTransaction: async (_input: any) => {
      const core = {
        authorization_url: 'https://checkout.paystack.com/c8-fake-3ds-page',
        access_code: 'c8-fake',
        reference:
          'C8DEP-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      };
      return { status: true, message: 'Authorization created', data: core, ...core };
    },
    ensurePaystackCustomer: async (_email: string, _name?: string) => 'CUS_c8test',
    verifyTransaction: async (_reference: string) =>
      ({ status: 'success', amount: 0, fees: 0, currency: 'ZAR' }) as any,
    fetchTransaction: async (_id: number) =>
      ({ status: 'success', amount_refunded: 0, fees: 0 }) as any,
  };
});

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
const SECRET = 'test-secret-key-for-testing-min-32-chars';
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

const bookingBody = (over: Record<string, any> = {}) => ({
  checkIn: ctx.inA,
  checkOut: ctx.outA,
  adults: 2,
  children: 0,
  roomTypeId: ctx.typeA,
  guest: {
    firstName: 'C8',
    lastName: 'Ads',
    email: `c8-${runId}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    phone: '+27123456789',
  },
  ...over,
});

beforeAll(async () => {
  for (const k of ['PAYSTACK_SECRET_KEY', 'PAYSTACK_SECRET', 'PAYSTACK_WEBHOOK_SECRET']) {
    process.env[k] = SECRET;
  }
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app ?? mod.server;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;

  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'C8',
      code: ('C8' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'C8 RT',
      code: 'C8RT' + runId.toUpperCase().slice(-4),
    },
  });
  for (let i = 1; i <= 3; i++) {
    await prisma.room.create({
      data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: 'C8-' + i },
    });
  }
  await prisma.ratePlan.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      roomTypeId: rt.id,
      name: 'C8 Base',
      code: 'C8B' + runId.toUpperCase().slice(-4),
      baseRate: 1200,
      status: 'active',
    },
  });

  const inA = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  const outA = new Date(Date.now() + 12 * 86400_000).toISOString().slice(0, 10);
  ctx.t = t;
  ctx.propCode = prop.code;
  ctx.propId = prop.id;
  ctx.typeA = rt.id;
  ctx.inA = inA;
  ctx.outA = outA;
  console.log('C8′ seeded');
}, 120_000);

describe('C8′ hotel-ads attribution', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });

  it('S1: utm google/hotel_ads booking records source google_hotel_ads', async () => {
    const res = await request(app)
      .post(`/v1/public/properties/${ctx.propCode}/bookings`)
      .send(
        bookingBody({
          attribution: { utmSource: 'google', utmMedium: 'hotel_ads', utmCampaign: 'free_links' },
        })
      );
    expect(res.status).toBe(201);
    const conf =
      res.body.data?.reservation?.confirmationNumber ?? res.body.data?.confirmationNumber;
    expect(conf).toBeTruthy();
    const r = await prisma.reservation.findFirst({
      where: { tenantId: ctx.t, confirmationNumber: conf },
    });
    expect(r?.source).toBe('google_hotel_ads');
    ctx.confAds = conf;
    console.log('C8′ S1 OK — hotel-ads source recorded');
  }, 120_000);

  it('S2: organic booking records source direct', async () => {
    const res = await request(app)
      .post(`/v1/public/properties/${ctx.propCode}/bookings`)
      .send(bookingBody());
    expect(res.status).toBe(201);
    const conf =
      res.body.data?.reservation?.confirmationNumber ?? res.body.data?.confirmationNumber;
    const r = await prisma.reservation.findFirst({
      where: { tenantId: ctx.t, confirmationNumber: conf },
    });
    expect(r?.source).toBe('direct');
    console.log('C8′ S2 OK — organic stays direct');
  }, 120_000);

  it('S3: attribution endpoint groups by source with counts and revenue', async () => {
    const res = await request(app).get('/v1/reservations/attribution').set(H());
    expect(res.status).toBe(200);
    const rows = res.body.data as any[];
    const ads = rows.find((x) => x.source === 'google_hotel_ads');
    const organic = rows.find((x) => x.source === 'direct');
    expect(ads?._count?.id).toBeGreaterThanOrEqual(1);
    expect(Number(ads?._sum?.totalAmount ?? 0)).toBeGreaterThanOrEqual(1200);
    expect(organic?._count?.id).toBeGreaterThanOrEqual(1);
    console.log('C8′ S3 OK — attribution visible');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
