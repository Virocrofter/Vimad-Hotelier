/* C5′ — importers: parse/preview, dry-run (proven write-free), commit with
 * dedupe, iCal adapter, and the persisted run log (zero silent failures).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

const NB_CSV = `First Name,Last Name,Email,Phone,Arrival,Departure,Conf,Adults
Thabo,Mokoena,thabo-${runId}@example.com,+2782000001,2026-12-01,2026-12-03,NB-${runId}-1,2
"Naledi, Jr",Khumalo,dup-${runId}@example.com,+2782000002,2026-12-05,2026-12-07,NB-${runId}-2,1
Broken,Row,broken-${runId}@example.com,,2026-12-10,2026-12-08,NB-${runId}-3,1`;

const ICAL = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:ICAL-${runId}-1
SUMMARY:Jane Doe
DTSTART;VALUE=DATE:20261125
DTEND;VALUE=DATE:20261127
DESCRIPTION:email:jane-${runId}@example.com\\nphone:+27123456789
END:VEVENT
BEGIN:VEVENT
UID:ICAL-${runId}-2
SUMMARY:Bad Dates
DTSTART;VALUE=DATE:20261128
DTEND;VALUE=DATE:20261126
END:VEVENT
END:VCALENDAR`;

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;
  const prop = await prisma.property.create({
    data: {
      tenantId: t,
      name: 'C5',
      code: ('C5' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  await prisma.guest.create({
    data: { tenantId: t, firstName: 'Dup', lastName: 'Guest', email: `dup-${runId}@example.com` },
  });
  ctx.t = t;
  ctx.propId = prop.id;
  console.log('C5′ seeded');
}, 90000);

describe('C5′ importers', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });

  it('S1: parse returns columns and raw sample', async () => {
    const r = await request(app)
      .post('/v1/importers/parse')
      .set(H())
      .send({ format: 'nightsbridge', content: NB_CSV });
    expect(r.status).toBe(200);
    expect(r.body.data.columns.map((c: string) => c.toLowerCase())).toContain('email');
    expect(r.body.data.sample.length).toBe(3);
    console.log('C5′ S1 OK — parse preview');
  }, 60000);

  it('S2: dry-run reports fully and writes NOTHING', async () => {
    const before = {
      guests: await prisma.guest.count({ where: { tenantId: ctx.t } }),
      reservations: await prisma.reservation.count({ where: { tenantId: ctx.t } }),
    };
    const r = await request(app)
      .post('/v1/importers/run')
      .set(H())
      .send({ format: 'nightsbridge', content: NB_CSV, mode: 'dry_run' });
    expect(r.status).toBe(200);
    const rep = r.body.data.report;
    expect(rep).toMatchObject({ total: 3, valid: 1, duplicate: 1 });
    expect(rep.errors.length).toBe(1);
    expect(rep.errors[0].messages.join(' ')).toMatch(/departure/i);
    expect(rep.created).toBeUndefined();

    const after = {
      guests: await prisma.guest.count({ where: { tenantId: ctx.t } }),
      reservations: await prisma.reservation.count({ where: { tenantId: ctx.t } }),
    };
    expect(after).toEqual(before);
    console.log('C5′ S2 OK — dry-run write-free, errors reported per row');
  }, 60000);

  it('S3: commit creates valid rows; re-commit dedupes everything', async () => {
    const r = await request(app)
      .post('/v1/importers/run')
      .set(H())
      .send({ format: 'nightsbridge', content: NB_CSV, mode: 'commit', propertyId: ctx.propId });
    expect(r.status).toBe(200);
    expect(r.body.data.report.created).toEqual({ guests: 1, reservations: 1 });

    const guest = await prisma.guest.findFirst({
      where: { tenantId: ctx.t, email: `thabo-${runId}@example.com` },
    });
    expect(guest).toBeTruthy();
    const res = await prisma.reservation.findFirst({
      where: { tenantId: ctx.t, confirmationNumber: `NB-${runId}-1` },
    });
    expect(res?.nights).toBe(2);

    const again = await request(app)
      .post('/v1/importers/run')
      .set(H())
      .send({ format: 'nightsbridge', content: NB_CSV, mode: 'commit', propertyId: ctx.propId });
    expect(again.body.data.report.created).toEqual({ guests: 0, reservations: 0 });
    expect(again.body.data.report.duplicate).toBeGreaterThanOrEqual(1);
    console.log('C5′ S3 OK — commit creates, dedupe protects');
  }, 60000);

  it('S4: iCal adapter parses VEVENTs with validation', async () => {
    const r = await request(app)
      .post('/v1/importers/run')
      .set(H())
      .send({ format: 'ical', content: ICAL, mode: 'dry_run' });
    expect(r.status).toBe(200);
    const rep = r.body.data.report;
    expect(rep.total).toBe(2);
    expect(rep.valid).toBe(1);
    expect(rep.errors.length).toBe(1);
    console.log('C5′ S4 OK — iCal parsed + validated');
  }, 60000);

  it('S5: every run is logged with its report (zero silent failures)', async () => {
    const r = await request(app).get('/v1/importers/runs').set(H());
    expect(r.status).toBe(200);
    const mine = r.body.data.filter((x: any) => x.report && typeof x.report.total === 'number');
    expect(mine.length).toBeGreaterThanOrEqual(3);
    expect(mine.some((x: any) => x.mode === 'dry_run')).toBe(true);
    expect(mine.some((x: any) => x.mode === 'commit')).toBe(true);
    console.log('C5′ S5 OK — run log complete');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
