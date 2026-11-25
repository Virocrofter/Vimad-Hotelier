/* P42 — SA compliance bundle: TGCSA/liquor expiry fields on Property (PATCH
 * round-trip), and the compliance-expiry-check task rule turning renewals
 * due within 60 days into deduped, actionable tasks.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let adminToken: string;
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
  ctx.tenantId = agent.tenantId;
  const H = { Authorization: 'Bearer ' + agent.token };

  const mkProp = (name: string, extra: Record<string, unknown> = {}) =>
    prisma.property.create({
      data: {
        tenantId: agent.tenantId,
        name,
        code: (name + runId)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(-12),
        ...extra,
      },
    });
  ctx.pIn = await mkProp('CB In', { tgcsaCertificateExpiry: new Date(iso(40) + 'T12:00:00') });
  ctx.pExpired = await mkProp('CB Old', { liquorLicenceExpiry: new Date(iso(-5) + 'T12:00:00') });
  ctx.pFar = await mkProp('CB Far', {
    tgcsaCertificateExpiry: new Date(iso(200) + 'T12:00:00'),
    liquorLicenceExpiry: new Date(iso(70) + 'T12:00:00'),
  });

  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const email = `cb-a-owner-${runId}@example.com`;
  const password = 'cb-evidence-1234';
  await request(app)
    .post('/v1/users')
    .set(H)
    .send({ email, firstName: 'CB', lastName: 'owner', password, role: 'owner' });
  const lg = await request(app).post('/auth/login').send({ tenantSlug: slug, email, password });
  adminToken = (lg.body?.data ?? lg.body)?.token;
  ctx.admin = () => ({ Authorization: 'Bearer ' + adminToken });

  const rule = await request(app)
    .post('/v1/tasks/rules')
    .set(ctx.admin())
    .send({
      key: 'compliance-expiry-check',
      name: 'compliance ' + runId,
      department: 'management',
      trigger: { type: 'schedule', everyMinutes: 60 },
      action: {
        title: 'Renew {{label}} — {{property}} (expires {{expires}})',
        department: 'management',
        priority: 'high',
      },
    });
  expect(rule.status).toBe(201);
  ctx.ruleId = rule.body.data.id;
  ctx.svc = await import('../../src/modules/tasks/tasks.service.js');
  console.log('P42 seeded');
}, 90000);

describe('P42 SA compliance bundle', () => {
  it('S1: PATCH stores + returns the compliance fields', async () => {
    const r = await request(app)
      .patch(`/v1/properties/${ctx.pIn.id}`)
      .set(ctx.admin())
      .send({
        tgcsaGrade: '4_star',
        popiaInformationOfficerName: 'Dana Officer',
        popiaInformationOfficerEmail: `dana-${runId}@example.com`,
      });
    expect(r.status).toBe(200);

    const got = await request(app).get(`/v1/properties/${ctx.pIn.id}`).set(ctx.admin());
    expect(got.status).toBe(200);
    expect(got.body.data.tgcsaGrade).toBe('4_star');
    expect(got.body.data.tgcsaCertificateExpiry).toBeTruthy();
    expect(got.body.data.popiaInformationOfficerName).toBe('Dana Officer');
    expect(got.body.data.popiaInformationOfficerEmail).toBe(`dana-${runId}@example.com`);
    console.log('P42 S1 OK — fields PATCHable + API-visible');
  }, 60000);

  it('S2: expiries in the 60-day window become tasks; outside stays silent', async () => {
    const created = await ctx.svc.evaluateRule(ctx.ruleId);
    expect(created).toBe(2); // +40d TGCSA (CB In) + expired liquor (CB Old)
    const tasks = await prisma.task.findMany({ where: { ruleId: ctx.ruleId } });
    const inTask = tasks.find((t: any) => t.title.includes('CB In'));
    const oldTask = tasks.find((t: any) => t.title.includes('CB Old'));
    expect(inTask.title).toContain('TGCSA certificate');
    expect(inTask.title).toContain(iso(40));
    expect(inTask.priority).toBe('high');
    expect(oldTask.title).toContain('Liquor licence');
    expect(tasks.some((t: any) => t.title.includes('CB Far'))).toBe(false);
    console.log('P42 S2 OK — window honored, overdue flagged, far dates silent');
  }, 60000);

  it('S3: re-evaluation dedupes open tasks', async () => {
    const again = await ctx.svc.evaluateRule(ctx.ruleId);
    expect(again).toBe(0);
    const count = await prisma.task.count({ where: { ruleId: ctx.ruleId } });
    expect(count).toBe(2);
    console.log('P42 S3 OK — no duplicate renewal tasks');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
