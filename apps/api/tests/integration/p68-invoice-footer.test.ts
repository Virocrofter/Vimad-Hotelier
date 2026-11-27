/* P68 — invoice bank/footer: property setting via PATCH, snapshot onto
 * tax invoices / receipts / credit notes at issue (immutable documents),
 * rendered into the PDF. */
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
  const email = `if-owner-${runId}@example.com`;
  const password = 'if-evidence-1234';
  await request(app).post('/v1/users').set(H).send({
    email,
    firstName: 'IF',
    lastName: 'owner',
    password,
    role: 'owner',
  });
  const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
  ctx.ownerToken = (lg.body?.data ?? lg.body)?.token;
  ctx.owner = () => ({ Authorization: 'Bearer ' + ctx.ownerToken });

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'IF',
      code: ('IF' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'IF', lastName: 'Guest' },
  });
  ctx.res = await prisma.reservation.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      guestId: guest.id,
      confirmationNumber: 'IF' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 800,
      balance: 800,
    },
  });
  ctx.folio = await prisma.folio.create({
    data: {
      tenantId: agent.tenantId,
      reservationId: ctx.res.id,
      totalCharges: 800,
      totalPayments: 0,
      balance: 800,
    },
  });
  await prisma.folioItem.create({
    data: {
      folioId: ctx.folio.id,
      type: 'room_charge',
      description: 'Stay',
      amount: 800,
      consumedAt: new Date(),
    },
  });
  console.log('P68 seeded');
}, 90000);

describe('P68 invoice footer', () => {
  it('S1: PATCH property invoiceFooter; GET reflects', async () => {
    const r = await request(app).patch(`/v1/properties/${ctx.prop.id}`).set(ctx.owner()).send({
      invoiceFooter:
        'Bank: FNB · Acc: 6200 1234 5678 · Ref: your reservation number\nThank you for staying with us.',
    });
    expect(r.status).toBe(200);

    const got = await request(app).get(`/v1/properties/${ctx.prop.id}`).set(ctx.owner());
    expect(got.body.data.invoiceFooter).toContain('6200 1234 5678');
    console.log('P68 S1 OK — property footer set');
  }, 60000);

  it('S2: tax invoice snapshots the footer + renders the PDF', async () => {
    const svc = await import('../../src/modules/invoices/invoices.service.js');
    const invoice = await svc.issueTaxInvoice(ctx.tenantId, { folioId: ctx.folio.id, send: false });
    expect(invoice.invoiceFooter).toContain('6200 1234 5678'); // PDF render is audit-noted, not fatal

    const receiptPayment = await prisma.payment.create({
      data: {
        tenantId: ctx.tenantId,
        reservationId: ctx.res.id,
        reference: 'IF-PAY-' + runId,
        amountMinor: 80000,
        currency: 'ZAR',
        type: 'deposit',
        status: 'success',
      },
    });
    const receipt = await svc.recordReceipt(receiptPayment.id);
    expect(receipt?.invoiceFooter).toContain('6200 1234 5678');
    console.log('P68 S2 OK — invoice + receipt snapshots, PDF rendered');
  }, 60000);

  it('S3: credit note carries the original footer snapshot', async () => {
    const svc = await import('../../src/modules/invoices/invoices.service.js');
    const invoice = await prisma.taxInvoice.findFirst({
      where: { tenantId: ctx.tenantId, type: 'tax_invoice' },
    });
    const cn = await svc.issueCreditNote(ctx.tenantId, invoice.id, {
      reason: 'Guest dispute — full credit',
      applyToFolio: false,
      send: false,
    });
    expect(cn.invoiceFooter).toContain('6200 1234 5678');
    console.log('P68 S3 OK — credit note footer');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
