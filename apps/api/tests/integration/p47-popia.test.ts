/* P47 — POPIA arc: (S1) erasure verified against the live gdpr.job handlers +
 * Property compliance fields PATCHable; (S2) ID-scan purge — platform janitor,
 * global by design (like the GDPR worker), retention window, category filter,
 * proof rows, idempotence; (S3) breach ledger lifecycle + gate.
 * Sweep runs BEFORE this run's seeds so stale rows from earlier failed runs
 * are absorbed and the exact-count assertions are deterministic.
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
  ctx.H = { Authorization: 'Bearer ' + agent.token };

  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string) => {
    const email = `po-${role}-${runId}@example.com`;
    const password = 'po-evidence-1234';
    await request(app)
      .post('/v1/users')
      .set(ctx.H)
      .send({ email, firstName: 'PO', lastName: role, password, role });
    const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
    return (lg.body?.data ?? lg.body)?.token;
  };
  ctx.adminToken = await mkUser('owner');
  ctx.staffToken = await mkUser('staff');
  ctx.admin = () => ({ Authorization: 'Bearer ' + ctx.adminToken });
  ctx.staff = () => ({ Authorization: 'Bearer ' + ctx.staffToken });

  ctx.gdpr = await import('../../src/jobs/gdpr.job.js');
  ctx.popia = await import('../../src/jobs/popia.job.js');

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'PO',
      code: ('PO' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });

  ctx.other = await mod.registerTestAgent(app);

  console.log('P47 seeded');
}, 90000);

describe('P47 POPIA arc', () => {
  it('S1: erasure verified (anonymize scrubs, delete erases) + compliance fields on Property', async () => {
    const patch = await request(app)
      .patch(`/v1/properties/${ctx.prop.id}`)
      .set(ctx.admin())
      .send({
        tgcsaGrade: '4_star',
        popiaInformationOfficerName: 'POPIA Officer',
        popiaInformationOfficerEmail: `po-officer-${runId}@example.com`,
      });
    expect(patch.status).toBe(200);

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
    console.log('P47 S1 OK — erasure verified on live handlers + compliance fields PATCHable');
  }, 60000);

  it('S2: purge — retention window + category filter + proof rows + idempotence (global janitor)', async () => {
    // Absorb stale rows from earlier failed runs BEFORE seeding, so the
    // exact-count assertions below are deterministic.
    await ctx.popia.purgeIdScans(30);

    const guest = await prisma.guest.create({
      data: { tenantId: ctx.tenantId, firstName: 'PO', lastName: 'Guest' },
    });
    const mkRes = (departure: Date, conf: string) =>
      prisma.reservation.create({
        data: {
          tenantId: ctx.tenantId,
          propertyId: ctx.prop.id,
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
    const resOld = await mkRes(d(-40), 'POOLD' + runId.toUpperCase().slice(-4));
    const resNew = await mkRes(d(-10), 'PONEW' + runId.toUpperCase().slice(-4));

    const foreignGuest = await prisma.guest.create({
      data: { tenantId: ctx.other.tenantId, firstName: 'PO', lastName: 'Foreign' },
    });
    const foreignProp = await prisma.property.create({
      data: {
        tenantId: ctx.other.tenantId,
        name: 'POF',
        code: ('POF' + runId)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(-12),
      },
    });
    const foreignRes = await prisma.reservation.create({
      data: {
        tenantId: ctx.other.tenantId,
        propertyId: foreignProp.id,
        guestId: foreignGuest.id,
        confirmationNumber: 'POFOR' + runId.toUpperCase().slice(-4),
        status: 'checked_out',
        arrivalDate: d(-41),
        departureDate: d(-40),
        nights: 1,
        totalAmount: 500,
        balance: 0,
      },
    });

    const mkDoc = (
      tenantId: string,
      resId: string,
      category: string,
      key: string,
      extra: Record<string, unknown> = {}
    ) =>
      prisma.reservationDocument.create({
        data: { tenantId, reservationId: resId, key, name: 'scan.pdf', category, ...extra },
      });
    const docPurge = await mkDoc(
      ctx.tenantId,
      resOld.id,
      'passport',
      `documents/${runId}/old-passport.pdf`
    );
    const docRecent = await mkDoc(
      ctx.tenantId,
      resNew.id,
      'id_scan',
      `documents/${runId}/new-scan.pdf`
    );
    const docContract = await mkDoc(
      ctx.tenantId,
      resOld.id,
      'contract',
      `documents/${runId}/contract.pdf`
    );
    const docDone = await mkDoc(
      ctx.tenantId,
      resOld.id,
      'id_scan',
      `documents/${runId}/already.pdf`,
      {
        purgedAt: d(-5),
      }
    );
    const docForeign = await mkDoc(
      ctx.other.tenantId,
      foreignRes.id,
      'passport',
      `documents/${runId}/foreign-passport.pdf`
    );

    const r = await ctx.popia.purgeIdScans(30);
    // Ours + the foreign tenant's stale scan — the janitor is global by design
    // (same platform-sweep model as the GDPR worker).
    expect(r.purged).toBe(2);

    const purged = await prisma.reservationDocument.findFirst({ where: { id: docPurge.id } });
    expect(purged.key).toBe('');
    expect(purged.purgedAt).toBeTruthy();

    const foreignAfter = await prisma.reservationDocument.findFirst({
      where: { id: docForeign.id },
    });
    expect(foreignAfter.key).toBe('');
    expect(foreignAfter.purgedAt).toBeTruthy();

    const recent = await prisma.reservationDocument.findFirst({ where: { id: docRecent.id } });
    expect(recent.key).toBeTruthy();
    const contract = await prisma.reservationDocument.findFirst({ where: { id: docContract.id } });
    expect(contract.key).toBeTruthy();
    const done = await prisma.reservationDocument.findFirst({ where: { id: docDone.id } });
    expect(done.purgedAt).toBeTruthy();
    expect(done.key).toBeTruthy();

    const again = await ctx.popia.purgeIdScans(30);
    expect(again.purged).toBe(0);
    console.log('P47 S2 OK — window + categories + idempotence (global janitor)');
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
    const incidentId = c.body.data.id;

    const staffCreate = await request(app)
      .post('/v1/compliance/incidents')
      .set(ctx.staff())
      .send({ type: 'x', title: 'x' });
    expect(staffCreate.status).toBe(403);

    const inv = await request(app)
      .post(`/v1/compliance/incidents/${incidentId}/status`)
      .set(ctx.admin())
      .send({ status: 'investigating' });
    expect(inv.body.data.status).toBe('investigating');

    const notify = await request(app)
      .post(`/v1/compliance/incidents/${incidentId}/notify-officer`)
      .set(ctx.admin());
    expect(notify.body.data.officerNotified).toBe(true);

    const res = await request(app)
      .post(`/v1/compliance/incidents/${incidentId}/status`)
      .set(ctx.admin())
      .send({ status: 'resolved', resolution: 'POPIA officer briefed; access policy retrained' });
    expect(res.body.data.status).toBe('resolved');
    expect(res.body.data.resolvedAt).toBeTruthy();

    const again = await request(app)
      .post(`/v1/compliance/incidents/${incidentId}/status`)
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
