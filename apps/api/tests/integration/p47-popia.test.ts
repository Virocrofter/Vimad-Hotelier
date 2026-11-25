/* P47 — POPIA arc: (S1) erasure path verified end-to-end against the live
 * gdpr.job handlers; (S2) ID-scan purge — raw scans purged 30 days after
 * checkout, row kept as proof, idempotent; (S3) breach log lifecycle + gate.
 */
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
    const email = `po-${role}-${runId}@example.com`;
    const password = 'po-evidence-1234';
    await request(app)
      .post('/v1/users')
      .set(H)
      .send({ email, firstName: 'PO', lastName: role, password, role });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.adminToken = await mkUser('owner');
  ctx.staffToken = await mkUser('staff');
  ctx.admin = () => ({ Authorization: 'Bearer ' + ctx.adminToken });
  ctx.staff = () => ({ Authorization: 'Bearer ' + ctx.staffToken });

  const prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'PO',
      code: ('PO' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.propId = prop.id;
  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'PO', lastName: 'Guest' },
  });
  const mkRes = (departure: Date, conf: string) =>
    prisma.reservation.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: prop.id,
        guestId: guest.id,
        confirmationNumber: conf,
        status: 'checked_out',
        arrivalDate: new Date(departure.getTime() - 86400_000),
        departureDate: departure,
        nights: 1,
        totalAmount: 500,
        balance: 0,
      },
    });
  ctx.resOld = await mkRes(d(-40), 'POOLD' + runId.toUpperCase().slice(-4));
  ctx.resNew = await mkRes(d(-10), 'PONEW' + runId.toUpperCase().slice(-4));
  const mkDoc = (
    resId: string,
    category: string,
    key: string | null,
    extra: Record<string, unknown> = {}
  ) =>
    prisma.reservationDocument.create({
      data: {
        tenantId: agent.tenantId,
        reservationId: resId,
        key,
        name: 'scan.pdf',
        category,
        ...extra,
      },
    });
  ctx.docPurge = await mkDoc(ctx.resOld.id, 'id_scan', `documents/${ctx.resOld.id}/old-scan.pdf`);
  ctx.docRecent = await mkDoc(ctx.resNew.id, 'id_scan', `documents/${ctx.resNew.id}/new-scan.pdf`);
  ctx.docContract = await mkDoc(
    ctx.resOld.id,
    'contract',
    `documents/${ctx.resOld.id}/contract.pdf`
  );
  ctx.docDone = await mkDoc(ctx.resOld.id, 'id_scan', '', { purgedAt: d(-5) });

  ctx.gdpr = await import('../../src/jobs/gdpr.job.js');
  ctx.popia = await import('../../src/jobs/popia.job.js');
  console.log('P47 seeded');
}, 90000);

describe('P47 POPIA arc', () => {
  it('S1: erasure path verified — anonymize scrubs PII, delete erases', async () => {
    const g1 = await prisma.guest.create({
      data: {
        tenantId: ctx.tenantId,
        firstName: 'Naledi',
        lastName: 'Mokoena',
        email: `naledi-${runId}@example.com`,
        phone: '0820000000',
        passportNumber: 'P1234567',
        notes: 'VIP — allergies',
      },
    });
    await ctx.gdpr.handleAnonymize(ctx.tenantId, 'guest', g1.id);
    const a1 = await prisma.guest.findFirst({ where: { id: g1.id } });
    expect(a1.firstName).toBe('ANONYMIZED');
    expect(a1.email).toBe(`anonymized-${g1.id.slice(-8)}@deleted.local`);
    expect(a1.passportNumber).toBeNull();
    expect(a1.phone).toBeNull();
    expect(a1.notes).toBeNull();

    const g2 = await prisma.guest.create({
      data: {
        tenantId: ctx.tenantId,
        firstName: 'Sipho',
        lastName: 'Dube',
        email: `sipho-${runId}@example.com`,
        loyaltyPoints: 420,
      },
    });
    await ctx.gdpr.handleDelete(ctx.tenantId, 'guest', g2.id);
    const a2 = await prisma.guest.findFirst({ where: { id: g2.id } });
    expect(a2.email).toBeNull();
    expect(a2.loyaltyPoints).toBe(0);
    expect(a2.notes).toContain('Article 17');
    console.log('P47 S1 OK — erasure path verified on live handlers');
  }, 60000);

  it('S2: purge — old ID scans purged (row kept as proof), recent/other kept, idempotent', async () => {
    const r = await ctx.popia.purgeIdScans(30);
    expect(r.purged).toBe(1);

    const purged = await prisma.reservationDocument.findFirst({ where: { id: ctx.docPurge.id } });
    expect(purged.key).toBe('');
    expect(purged.purgedAt).toBeTruthy();

    const recent = await prisma.reservationDocument.findFirst({ where: { id: ctx.docRecent.id } });
    expect(recent.key).toBeTruthy();
    const contract = await prisma.reservationDocument.findFirst({
      where: { id: ctx.docContract.id },
    });
    expect(contract.key).toBeTruthy();
    const done = await prisma.reservationDocument.findFirst({ where: { id: ctx.docDone.id } });
    expect(done.purgedAt).toBeTruthy();

    const again = await ctx.popia.purgeIdScans(30);
    expect(again.purged).toBe(0);
    console.log('P47 S2 OK — purge window + proof rows + idempotence');
  }, 60000);

  it('S3: breach log lifecycle + officer surface + role gate', async () => {
    const c = await request(app).post('/v1/compliance/incidents').set(ctx.admin()).send({
      type: 'unauthorized_access',
      severity: 'high',
      title: 'Front-desk terminal left unlocked',
      description: 'Guest ID data potentially viewed',
    });
    expect(c.status).toBe(201);
    expect(c.body.data.status).toBe('open');
    expect(c.body.data.officerNotified).toBe(false);
    ctx.incidentId = c.body.data.id;

    const staffCreate = await request(app)
      .post('/v1/compliance/incidents')
      .set(ctx.staff())
      .send({ type: 'x', title: 'x' });
    expect(staffCreate.status).toBe(403);

    const inv = await request(app)
      .post(`/v1/compliance/incidents/${ctx.incidentId}/status`)
      .set(ctx.admin())
      .send({ status: 'investigating' });
    expect(inv.body.data.status).toBe('investigating');

    const notify = await request(app)
      .post(`/v1/compliance/incidents/${ctx.incidentId}/notify-officer`)
      .set(ctx.admin());
    expect(notify.body.data.officerNotified).toBe(true);

    const res = await request(app)
      .post(`/v1/compliance/incidents/${ctx.incidentId}/status`)
      .set(ctx.admin())
      .send({ status: 'resolved', resolution: 'POPIA officer briefed; access policy retrained' });
    expect(res.body.data.status).toBe('resolved');
    expect(res.body.data.resolvedAt).toBeTruthy();

    const again = await request(app)
      .post(`/v1/compliance/incidents/${ctx.incidentId}/status`)
      .set(ctx.admin())
      .send({ status: 'resolved' });
    expect(again.status).toBe(409);

    const list = await request(app)
      .get('/v1/compliance/incidents?status=resolved')
      .set(ctx.admin());
    expect(list.body.data.length).toBe(1);

    const officer = await request(app).get('/v1/compliance/officer').set(ctx.admin());
    expect(officer.status).toBe(200);
    expect(Array.isArray(officer.body.data)).toBe(true);
    console.log('P47 S3 OK — breach ledger lifecycle + gate');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
