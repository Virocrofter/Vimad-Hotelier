/* P41 — D8 travel-agent portal: contract terms on overview, cutoff +
 * net-rate booking, account-scoped bookings/invoices, role gate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agentToken: string;
let staffToken: string;
const ctx: Record<string, any> = {};

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  const H = { Authorization: 'Bearer ' + agent.token };
  ctx.tenantId = agent.tenantId;

  const prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'AG',
      code: ('AG' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: prop.id,
      name: 'AG RT',
      code: 'AGRT' + runId.toUpperCase().slice(-4),
    },
  });
  ctx.roomTypeId = rt.id;

  ctx.agentAccount = await prisma.corporateAccount.create({
    data: {
      tenantId: agent.tenantId,
      name: 'Wanderlust Travel',
      isAgent: true,
      commissionPct: 10,
      cutoffDays: 2,
      netRateDiscountPct: 20,
      paymentTermsDays: 30,
    },
  });
  ctx.otherAccount = await prisma.corporateAccount.create({
    data: { tenantId: agent.tenantId, name: 'Other Agency', isAgent: true, cutoffDays: 0 },
  });

  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string, tag: string, accountId?: string) => {
    const email = `ag-${tag}-${role}-${runId}@example.com`;
    const password = 'ag-evidence-1234';
    await request(app)
      .post('/v1/users')
      .set(H)
      .send({ email, firstName: 'AG', lastName: role, password, role });
    if (accountId) {
      await prisma.user.updateMany({
        where: { tenantId: agent.tenantId, email },
        data: { agentAccountId: accountId },
      });
    }
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  agentToken = await mkUser('travel_agent', 'ta', ctx.agentAccount.id);
  staffToken = await mkUser('staff', 'st');
  ctx.agent = () => ({ Authorization: 'Bearer ' + agentToken });
  ctx.staff = () => ({ Authorization: 'Bearer ' + staffToken });
  console.log('P41 seeded');
}, 90000);

describe('P41 travel-agent portal (D8)', () => {
  it('S1: overview shows the contract terms + empty books', async () => {
    const r = await request(app).get('/v1/agents/portal/overview').set(ctx.agent());
    expect(r.status).toBe(200);
    expect(r.body.data.account.commissionPct).toBe(10);
    expect(r.body.data.account.cutoffDays).toBe(2);
    expect(r.body.data.account.netRateDiscountPct).toBe(20);
    expect(r.body.data.bookingCount).toBe(0);
    console.log('P41 S1 OK — contract terms live on the account');
  }, 60000);

  it('S2: booking priced at net with cutoff enforced', async () => {
    const ok = await request(app)
      .post('/v1/agents/portal/bookings')
      .set(ctx.agent())
      .send({
        guestFirstName: 'Nia',
        guestLastName: 'Nomad',
        guestEmail: `nia-${runId}@example.com`,
        roomTypeId: ctx.roomTypeId,
        arrivalDate: iso(3),
        departureDate: iso(5),
        grossAmount: 1000,
      });
    expect(ok.status).toBe(201);
    expect(ok.body.data.netAmount).toBe(800);
    ctx.bookingId = ok.body.data.id;

    const res = await prisma.reservation.findFirst({ where: { id: ctx.bookingId } });
    expect(res.agentAccountId).toBe(ctx.agentAccount.id);
    expect(res.source).toBe('travel_agent');

    const tooSoon = await request(app)
      .post('/v1/agents/portal/bookings')
      .set(ctx.agent())
      .send({
        guestFirstName: 'Early',
        guestLastName: 'Bird',
        roomTypeId: ctx.roomTypeId,
        arrivalDate: iso(1),
        departureDate: iso(3),
        grossAmount: 500,
      });
    expect(tooSoon.status).toBe(409);
    expect(tooSoon.body.error.code).toBe('CUTOFF_BREACHED');
    console.log('P41 S2 OK — net pricing + cutoff contract enforced');
  }, 60000);

  it('S3: bookings scoped to my account', async () => {
    const otherGuest = await prisma.guest.create({
      data: { tenantId: ctx.tenantId, firstName: 'Other', lastName: 'Agency' },
    });
    await prisma.reservation.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: (await prisma.roomType.findFirst({ where: { id: ctx.roomTypeId } }))!
          .propertyId,
        guestId: otherGuest.id,
        confirmationNumber: 'AGT-OTHER' + runId.toUpperCase().slice(-4),
        status: 'confirmed',
        agentAccountId: ctx.otherAccount.id,
        arrivalDate: new Date(iso(3)),
        departureDate: new Date(iso(4)),
        nights: 1,
        totalAmount: 700,
        balance: 700,
      },
    });
    const r = await request(app).get('/v1/agents/portal/bookings').set(ctx.agent());
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBe(1);
    expect(r.body.data[0].id).toBe(ctx.bookingId);
    console.log('P41 S3 OK — agent sees only their own bookings');
  }, 60000);

  it('S4: invoices surfaced (AR lifecycle); staff role gated', async () => {
    await prisma.arInvoice.create({
      data: {
        tenantId: ctx.tenantId,
        corporateAccountId: ctx.agentAccount.id,
        number: 'AR-AGT-' + runId.toUpperCase().slice(-6),
        status: 'sent',
        subtotal: 800,
        vatAmount: 120,
        total: 920,
        amountPaid: 0,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400_000),
      },
    });
    const inv = await request(app).get('/v1/agents/portal/invoices').set(ctx.agent());
    expect(inv.status).toBe(200);
    expect(inv.body.data.length).toBe(1);
    expect(inv.body.data[0].balance).toBe(920);

    const staffHit = await request(app).get('/v1/agents/portal/overview').set(ctx.staff());
    expect(staffHit.status).toBe(403);
    console.log('P41 S4 OK — invoice lifecycle visible, role gate holds');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
