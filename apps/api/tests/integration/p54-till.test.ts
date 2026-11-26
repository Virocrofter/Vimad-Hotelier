/* P54 — F5 native till: open checks, items, split-by-move, comps with
 * reversal, exact-tender close with folio posting for room charges, and
 * cash-up sessions with variance. Schema-audit at the top per discipline.
 */
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
    const email = `tl-${role}-${runId}@example.com`;
    const password = 'tl-evidence-1234';
    await request(app).post('/v1/users').set(H).send({
      email,
      firstName: 'TL',
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
      name: 'TL',
      code: ('TL' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.item = await prisma.upsellProduct.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      name: 'Local lager',
      price: 55,
      status: 'active',
      category: 'beverage',
    },
  });

  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'TL', lastName: 'Guest' },
  });
  ctx.res = await prisma.reservation.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      guestId: guest.id,
      confirmationNumber: 'TL' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 500,
      balance: 500,
    },
  });
  ctx.folio = await prisma.folio.create({
    data: {
      tenantId: agent.tenantId,
      reservationId: ctx.res.id,
      totalCharges: 500,
      totalPayments: 0,
      balance: 500,
    },
  });

  await prisma.folioItem.create({
    data: {
      folioId: ctx.folio.id,
      type: 'room_charge',
      description: 'Opening balance',
      amount: 500,
      consumedAt: new Date(),
    },
  });
  console.log('P54 seeded');
}, 90000);

describe('P54 native till (F5)', () => {
  it('S1: open check, add catalog + free items, totals exact, closed immutable', async () => {
    const c = await request(app)
      .post('/v1/till/checks')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, label: 'Table 4' });
    expect(c.status).toBe(201);
    ctx.checkId = c.body.data.id;

    const a = await request(app)
      .post(`/v1/till/checks/${ctx.checkId}/items`)
      .set(ctx.staff())
      .send({ productId: ctx.item.id, quantity: 2 });
    expect(a.status).toBe(201);
    expect(a.body.data.name).toBe('Local lager');

    await request(app)
      .post(`/v1/till/checks/${ctx.checkId}/items`)
      .set(ctx.staff())
      .send({ name: 'Biltong plate', unitPrice: 70 });

    const list = await request(app).get(`/v1/till/checks?status=open`).set(ctx.staff());
    const check = list.body.data.find((x: any) => x.id === ctx.checkId);
    expect(check.totalCharges).toBe(180);

    await prisma.tillCheck.update({ where: { id: ctx.checkId }, data: { status: 'closed' } });
    const late = await request(app)
      .post(`/v1/till/checks/${ctx.checkId}/items`)
      .set(ctx.staff())
      .send({ name: 'Late add', unitPrice: 10 });
    expect(late.status).toBe(409);
    await prisma.tillCheck.update({ where: { id: ctx.checkId }, data: { status: 'open' } });
    console.log('P54 S1 OK — checks + items + immutability');
  }, 60000);

  it('S2: split by move between open checks', async () => {
    const other = await request(app)
      .post('/v1/till/checks')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, label: 'Bar stool 1' });
    const list = await request(app).get('/v1/till/checks?status=open').set(ctx.staff());
    const first = list.body.data.find((x: any) => x.id === ctx.checkId);
    const itemToMove = first.items.find((i: any) => i.name === 'Biltong plate');

    const mv = await request(app)
      .post(`/v1/till/items/${itemToMove.id}/move`)
      .set(ctx.staff())
      .send({ toCheckId: other.body.data.id });
    expect(mv.status).toBe(200);

    const after = await request(app).get('/v1/till/checks?status=open').set(ctx.staff());
    const a = after.body.data.find((x: any) => x.id === ctx.checkId);
    const b = after.body.data.find((x: any) => x.id === other.body.data.id);
    expect(a.totalCharges).toBe(110);
    expect(b.totalCharges).toBe(70);
    ctx.splitCheckId = other.body.data.id;
    console.log('P54 S2 OK — split moves totals');
  }, 60000);

  it('S3: comp with reversal shifts totals both ways', async () => {
    const list = await request(app).get('/v1/till/checks?status=open').set(ctx.staff());
    const check = list.body.data.find((x: any) => x.id === ctx.checkId);
    const target = check.items[0];

    await request(app)
      .post(`/v1/till/items/${target.id}/comp`)
      .set(ctx.staff())
      .send({ reason: 'Warm beer replaced' });
    let now = (
      await request(app).get('/v1/till/checks?status=open').set(ctx.staff())
    ).body.data.find((x: any) => x.id === ctx.checkId);
    expect(now.totalComps).toBe(110);
    expect(Number(now.totalCharges) - Number(now.totalComps)).toBe(0);

    await request(app).post(`/v1/till/items/${target.id}/reverse-comp`).set(ctx.staff());
    now = (await request(app).get('/v1/till/checks?status=open').set(ctx.staff())).body.data.find(
      (x: any) => x.id === ctx.checkId
    );
    expect(now.totalComps).toBe(0);
    console.log('P54 S3 OK — comp + reversal exact');
  }, 60000);

  it('S4: close needs exact tenders; room tender posts to the folio; cash-up variance', async () => {
    const short = await request(app)
      .post(`/v1/till/checks/${ctx.checkId}/close`)
      .set(ctx.staff())
      .send({ payments: [{ method: 'cash', amountMinor: 10000 }] });
    expect(short.status).toBe(409);
    expect(short.body.error.code).toBe('TENDER_MISMATCH');

    const close = await request(app)
      .post(`/v1/till/checks/${ctx.checkId}/close`)
      .set(ctx.staff())
      .send({
        payments: [
          { method: 'room', amountMinor: 6000, reservationId: ctx.res.id },
          { method: 'cash', amountMinor: 5000 },
        ],
      });
    expect(close.status).toBe(200);
    expect(close.body.data.check.status).toBe('closed');
    expect(close.body.data.folioItemIds.length).toBe(1);

    const folio = await prisma.folio.findFirst({ where: { id: ctx.folio.id } });
    expect(Number(folio.totalCharges)).toBe(560);

    const sess = await request(app)
      .post('/v1/till/sessions/open')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, openingFloatMinor: 50000 });
    expect(sess.status).toBe(201);

    const again = await request(app)
      .post('/v1/till/sessions/open')
      .set(ctx.staff())
      .send({ propertyId: ctx.prop.id, openingFloatMinor: 100 });
    expect(again.status).toBe(409);

    // A cash tender INSIDE the session window must count toward expected cash
    // (the pre-session close's tenders are correctly excluded).
    const inSession = await request(app)
      .post(`/v1/till/checks/${ctx.splitCheckId}/close`)
      .set(ctx.staff())
      .send({ payments: [{ method: 'cash', amountMinor: 7000 }] });
    expect(inSession.status).toBe(200);

    const done = await request(app)
      .post(`/v1/till/sessions/${sess.body.data.id}/close`)
      .set(ctx.staff())
      .send({ countedCashMinor: 57000 });
    expect(done.status).toBe(200);
    expect(done.body.data.expectedCashMinor).toBe(57000);
    expect(done.body.data.varianceMinor).toBe(0);
    console.log('P54 S4 OK — close, folio post, cash-up exact');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
