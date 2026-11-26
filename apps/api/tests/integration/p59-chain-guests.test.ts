/* P59 — 11.1 chain-shared guest lookup: arrivals across chain properties in
 * the next N days, flagged when the guest stayed at a sister property. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

const d = (offset: number) => {
  const x = new Date();
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() + offset);
  return x;
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
    const email = `cg-${role}-${runId}@example.com`;
    const password = 'cg-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'CG',
      lastName: role,
      password,
      role,
    });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.staffToken = await mkUser('staff');
  ctx.staff = () => ({ Authorization: 'Bearer ' + ctx.staffToken });

  ctx.chain = await prisma.chain.create({
    data: {
      tenantId: agent.tenantId,
      name: 'Coastal Group ' + runId,
      slug: 'coastal-' + runId.toLowerCase(),
    },
  });
  const mkProp = async (name: string, chainId: string | null) =>
    prisma.property.create({
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
  ctx.propA = await mkProp('CGA', ctx.chain.id);
  ctx.propB = await mkProp('CGB', ctx.chain.id);
  ctx.propC = await mkProp('CGC', null); // not in the chain

  ctx.returningGuest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'Ayo', lastName: 'Balogun' },
  });
  ctx.newGuest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'Zanele', lastName: 'Khumalo' },
  });

  const mkRes = (guest: any, prop: any, arr: Date, dep: Date, status: string, conf: string) =>
    prisma.reservation.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: prop.id,
        guestId: guest.id,
        confirmationNumber: conf,
        status,
        arrivalDate: arr,
        departureDate: dep,
        nights: 1,
        totalAmount: 800,
        balance: 800,
      },
    });

  // Past stay at sister propA → the returning guest is now arriving at propB.
  await mkRes(
    ctx.returningGuest,
    ctx.propA,
    d(-30),
    d(-29),
    'checked_out',
    'CGP1' + runId.toUpperCase().slice(-4)
  );
  ctx.arrival = await mkRes(
    ctx.returningGuest,
    ctx.propB,
    d(2),
    d(4),
    'confirmed',
    'CGA1' + runId.toUpperCase().slice(-4)
  );
  await mkRes(
    ctx.newGuest,
    ctx.propB,
    d(1),
    d(3),
    'confirmed',
    'CGA2' + runId.toUpperCase().slice(-4)
  );
  // Outside the window (10 days out) and outside the chain — must not appear.
  await mkRes(
    ctx.newGuest,
    ctx.propB,
    d(10),
    d(12),
    'confirmed',
    'CGA3' + runId.toUpperCase().slice(-4)
  );
  await mkRes(
    ctx.newGuest,
    ctx.propC,
    d(1),
    d(3),
    'confirmed',
    'CGA4' + runId.toUpperCase().slice(-4)
  );

  ctx.other = await mod.registerTestAgent(app);
  console.log('P59 seeded');
}, 90000);

describe('P59 chain shared guests (11.1)', () => {
  it('S1: returning guest flagged via sister-property history; first-timer not', async () => {
    const r = await request(app)
      .get(`/v1/chains/${ctx.chain.id}/shared-arrivals?days=3`)
      .set(ctx.staff());
    expect(r.status).toBe(200);
    expect(r.body.data.arrivals.length).toBe(2);

    const returning = r.body.data.arrivals.find((a: any) => a.guestName.includes('Ayo'));
    expect(returning.returning).toBe(true);
    expect(returning.previousStaysAtSisters).toBe(1);
    expect(returning.propertyName).toBe('CGB');

    const fresh = r.body.data.arrivals.find((a: any) => a.guestName.includes('Zanele'));
    expect(fresh.returning).toBe(false);
    expect(fresh.previousStaysAtSisters).toBe(0);
    console.log('P59 S1 OK — sister-history flags');
  }, 60000);

  it('S2: window + chain membership honored', async () => {
    const r = await request(app)
      .get(`/v1/chains/${ctx.chain.id}/shared-arrivals?days=3`)
      .set(ctx.staff());
    const confs = r.body.data.arrivals.map((a: any) => a.confirmationNumber);
    expect(confs).not.toContain('CGA3' + runId.toUpperCase().slice(-4)); // 10 days out
    expect(confs).not.toContain('CGA4' + runId.toUpperCase().slice(-4)); // outside chain

    const wide = await request(app)
      .get(`/v1/chains/${ctx.chain.id}/shared-arrivals?days=14`)
      .set(ctx.staff());
    const wideConfs = wide.body.data.arrivals.map((a: any) => a.confirmationNumber);
    expect(wideConfs).toContain('CGA3' + runId.toUpperCase().slice(-4));
    console.log('P59 S2 OK — window + membership');
  }, 60000);

  it('S3: scoping — other tenants cannot read the chain', async () => {
    const foreign = await request(app)
      .get(`/v1/chains/${ctx.chain.id}/shared-arrivals?days=3`)
      .set({ Authorization: 'Bearer ' + ctx.other.token });
    expect(foreign.status).toBe(404);
    console.log('P59 S3 OK — scoping');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
