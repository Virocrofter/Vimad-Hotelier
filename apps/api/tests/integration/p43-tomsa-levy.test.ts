/* P43 — TOMSA 1% tourism levy: opt-in property auto-appends the levy line on
 * accommodation charges; remittance summary totals the month with the
 * property's TOMSA account reference.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let adminToken: string;
const ctx: Record<string, any> = {};

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  const H = { Authorization: 'Bearer ' + agent.token };

  const mk = (name: string) =>
    prisma.property.create({
      data: {
        tenantId: agent.tenantId,
        name,
        code: (name + runId)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(-12),
      },
    });
  ctx.propIn = await mk('TL In');
  ctx.propOut = await mk('TL Out');

  const mkFolio = async (propId: string, conf: string) => {
    const guest = await prisma.guest.create({
      data: { tenantId: agent.tenantId, firstName: 'TL', lastName: 'Guest' },
    });
    const res = await prisma.reservation.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: propId,
        guestId: guest.id,
        confirmationNumber: conf,
        status: 'checked_in',
        arrivalDate: new Date(),
        departureDate: new Date(Date.now() + 86400_000),
        nights: 1,
        totalAmount: 500,
        balance: 0,
      },
    });
    return prisma.folio.create({
      data: {
        tenantId: agent.tenantId,
        reservationId: res.id,
        totalCharges: 0,
        totalPayments: 0,
        balance: 0,
      },
    });
  };
  ctx.folioIn = await mkFolio(ctx.propIn.id, 'TLIN' + runId.toUpperCase().slice(-4));
  ctx.folioOut = await mkFolio(ctx.propOut.id, 'TLOUT' + runId.toUpperCase().slice(-3));

  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const email = `tl-a-owner-${runId}@example.com`;
  const password = 'tl-evidence-1234';
  await request(app)
    .post('/v1/users')
    .set(H)
    .send({ email, firstName: 'TL', lastName: 'owner', password, role: 'owner' });
  const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
  adminToken = (lg.body?.data ?? lg.body)?.token;
  ctx.admin = () => ({ Authorization: 'Bearer ' + adminToken });

  const patch = await request(app)
    .patch(`/v1/properties/${ctx.propIn.id}`)
    .set(ctx.admin())
    .send({ tomsaLevyEnabled: true, tomsaAccountCode: 'T1234' });
  expect(patch.status).toBe(200);
  expect(patch.body.data.tomsaLevyEnabled).toBe(true);
  expect(patch.body.data.tomsaAccountCode).toBe('T1234');

  ctx.svc = await import('../../src/modules/folios/folios.service.js');
  console.log('P43 seeded');
}, 90000);

describe('P43 TOMSA levy', () => {
  it('S1: opted-in property auto-appends the 1% levy on room charges', async () => {
    const item = await ctx.svc.postCharge(ctx.tenantId, ctx.folioIn.id, {
      type: 'room_charge',
      description: 'Room night',
      amount: 1000,
      quantity: 1,
    });
    expect(Number(item.amount)).toBe(1000);
    const levy = await prisma.folioItem.findFirst({
      where: { folioId: ctx.folioIn.id, type: 'tomsa_levy' },
    });
    expect(levy).toBeTruthy();
    expect(Number(levy.amount)).toBe(10);
    const folio = await prisma.folio.findFirst({ where: { id: ctx.folioIn.id } });
    expect(Number(folio.totalCharges)).toBe(1010);
    expect(Number(folio.balance)).toBe(1010);
    console.log('P43 S1 OK — levy line appended (1000 -> 10)');
  }, 60000);

  it('S2: service charges and opted-out properties carry no levy', async () => {
    await ctx.svc.postCharge(ctx.tenantId, ctx.folioIn.id, {
      type: 'service',
      description: 'Spa',
      amount: 500,
      quantity: 1,
    });
    await ctx.svc.postCharge(ctx.tenantId, ctx.folioOut.id, {
      type: 'room_charge',
      description: 'Room night',
      amount: 800,
      quantity: 1,
    });
    const leviesIn = await prisma.folioItem.count({
      where: { type: 'tomsa_levy', folioId: ctx.folioIn.id },
    });
    const leviesOut = await prisma.folioItem.count({
      where: { type: 'tomsa_levy', folioId: ctx.folioOut.id },
    });
    expect(leviesIn).toBe(1); // S1's levy only
    expect(leviesOut).toBe(0); // opted-out property never levies
    console.log('P43 S2 OK — non-room and opted-out stay levy-free');
  }, 60000);

  it('S3: remittance summary totals the month with the account reference', async () => {
    const r = await request(app)
      .get(`/v1/tomsa/remittance?propertyId=${ctx.propIn.id}&month=${thisMonth()}`)
      .set(ctx.admin());
    expect(r.status).toBe(200);
    expect(r.body.data.levyTotal).toBe(10);
    expect(r.body.data.lineCount).toBe(1);
    expect(r.body.data.property.tomsaAccountCode).toBe('T1234');
    expect(r.body.data.property.tomsaLevyEnabled).toBe(true);

    const empty = await request(app)
      .get(`/v1/tomsa/remittance?propertyId=${ctx.propOut.id}&month=${thisMonth()}`)
      .set(ctx.admin());
    expect(empty.body.data.levyTotal).toBe(0);

    const bad = await request(app)
      .get(`/v1/tomsa/remittance?propertyId=${ctx.propIn.id}&month=not-a-month`)
      .set(ctx.admin());
    expect(bad.status).toBe(400);
    console.log('P43 S3 OK — remittance summary correct');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
