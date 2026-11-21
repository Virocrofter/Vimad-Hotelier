/* C6-prime-V reconciliation: exported figures tie back to the folio.
 * S1: Xero export — journals balanced (Debits == Credits) and cross-foot to the
 *     seeded folio activity (charge 1000.00, payment leg 400.00).
 * S2: Pastel export — same balance + cross-foot on the Pastel columns.
 * S3: Traceability — every seeded folio movement (charge description, payment
 *     reference) appears in the export; nothing is dropped between folio and file.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

const day = (n: number) => {
  const d = new Date(Date.now() + n * 86400_000);
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;

  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'C6V',
      code: ('C6V' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'C6V RT',
      code: 'C6V' + runId.toUpperCase().slice(-4),
    },
  });
  const room = await prisma.room.create({
    data: { tenantId: t, propertyId: prop.id, roomTypeId: rt.id, number: 'C6V-1' },
  });
  const guest = await prisma.guest.create({
    data: {
      tenantId: t,
      firstName: 'C6V',
      lastName: 'Tie',
      email: 'c6v-' + runId + '@example.com',
    },
  });
  const res = await prisma.reservation.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      guestId: guest.id,
      confirmationNumber: 'C6V-' + runId.toUpperCase(),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 1000,
      balance: 500,
    },
  });
  const folio = await prisma.folio.create({
    data: { tenantId: t, reservationId: res.id, status: 'open' },
  });
  await prisma.folioItem.create({
    data: {
      folioId: folio.id,
      type: 'room',
      description: 'Room charge',
      amount: 1000,
      postedAt: new Date(),
    },
  });
  await prisma.payment.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      reservationId: res.id,
      guestId: guest.id,
      folioId: folio.id,
      reference: 'C6VPAY-' + runId,
      amountMinor: 40000,
      currency: 'ZAR',
      type: 'deposit',
      status: 'success',
      postedToFolio: true,
      channel: 'card',
      createdAt: new Date(),
    },
  });

  ctx.t = t;
  ctx.prop = prop;
  ctx.folio = folio;
  console.log('C6V seeded');
}, 90000);

describe('C6-prime-V reconciliation', () => {
  it('S1: Xero export — journals balanced, figures reconcile to the folio', async () => {
    const res = await request(app)
      .post('/v1/accounting/export')
      .set('Authorization', 'Bearer ' + agent.token)
      .send({ propertyId: ctx.prop.id, format: 'xero', dateFrom: day(-2), dateTo: day(1) });
    expect(res.status).toBe(200);
    const rows = (res.body.data.csv as string).split('\n').slice(1).filter(Boolean);
    let debits = 0;
    let credits = 0;
    for (const row of rows) {
      const cols = row.split(',');
      debits += Number(cols[5] || 0);
      credits += Number(cols[6] || 0);
    }
    expect(Math.abs(debits - credits)).toBeLessThan(0.005);
    expect(debits).toBeGreaterThanOrEqual(1000);
    expect(res.body.data.csv).toContain('1000.00');
    expect(res.body.data.csv).toContain('400.00');
    console.log('C6V S1 OK  debits=' + debits.toFixed(2) + ' credits=' + credits.toFixed(2));
  }, 60000);

  it('S2: Pastel export — balanced and cross-footed on Pastel columns', async () => {
    const res = await request(app)
      .post('/v1/accounting/export')
      .set('Authorization', 'Bearer ' + agent.token)
      .send({ propertyId: ctx.prop.id, format: 'pastel', dateFrom: day(-2), dateTo: day(1) });
    expect(res.status).toBe(200);
    const rows = (res.body.data.csv as string).split('\n').slice(1).filter(Boolean);
    let debit = 0;
    let credit = 0;
    for (const row of rows) {
      const cols = row.split(',');
      debit += Number(cols[4] || 0);
      credit += Number(cols[5] || 0);
    }
    expect(Math.abs(debit - credit)).toBeLessThan(0.005);
    expect(debit).toBeGreaterThanOrEqual(1000);
    console.log('C6V S2 OK  debit=' + debit.toFixed(2) + ' credit=' + credit.toFixed(2));
  }, 60000);

  it('S3: traceability — every folio movement appears in the export', async () => {
    const res = await request(app)
      .post('/v1/accounting/export')
      .set('Authorization', 'Bearer ' + agent.token)
      .send({ propertyId: ctx.prop.id, format: 'xero', dateFrom: day(-2), dateTo: day(1) });
    expect(res.status).toBe(200);
    const csv: string = res.body.data.csv;
    expect(csv).toContain('Room charge');
    expect(csv).toContain('C6VPAY-' + runId);
    console.log('C6V S3 OK');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
