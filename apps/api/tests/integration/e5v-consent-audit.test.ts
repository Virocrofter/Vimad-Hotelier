/* E5-V — consent audit verification. The surface ships (GET /consents,
 * POST /consents/filter, GET /consents/audit); this pins the behavior:
 * S1: per-guest history completeness — grant -> revoke -> re-grant with
 *     distinct sources, newest-first, nothing ever deleted.
 * S2: suppression filter — revoked excluded, re-granted included, purpose
 *     scoping honored (revoked for marketing but granted for newsletter).
 * S3: suppression trail — a send-time gate rejection writes a
 *     consent.suppressed audit row visible in /consents/audit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;

  const mk = async (tag: string) =>
    prisma.guest.create({
      data: {
        tenantId: t,
        firstName: 'E5',
        lastName: tag,
        email: `e5-${tag}-${runId}@example.com`,
      },
    });
  ctx.t = t;
  ctx.gA = await mk('Granted');
  ctx.gB = await mk('Revoked');
  ctx.gC = await mk('Never');
  ctx.gD = await mk('Cross');
  console.log('E5-V seeded');
}, 90000);

describe('E5-V consent audit', () => {
  const H = () => ({ Authorization: 'Bearer ' + agent.token });
  const grant = (guestId: string, purpose: string, source: string) =>
    request(app)
      .post('/v1/marketing/consents')
      .set(H())
      .send({ guestId, purpose, channel: 'email', status: 'granted', source });

  it('S1: per-guest history is complete, sourced, and newest-first', async () => {
    await grant(ctx.gA.id, 'marketing', 'booking');
    await request(app).post('/v1/marketing/consents').set(H()).send({
      guestId: ctx.gA.id,
      purpose: 'marketing',
      channel: 'email',
      status: 'revoked',
      source: 'unsubscribe',
    });
    await grant(ctx.gA.id, 'marketing', 'guest_portal');

    const r = await request(app)
      .get('/v1/marketing/consents?guestId=' + ctx.gA.id)
      .set(H());
    expect(r.status).toBe(200);
    const rows = r.body.data;
    expect(rows.length).toBe(3);
    expect(rows[0]).toMatchObject({ status: 'granted', source: 'guest_portal' });
    expect(rows[1]).toMatchObject({ status: 'revoked', source: 'unsubscribe' });
    expect(rows[2]).toMatchObject({ status: 'granted', source: 'booking' });
    expect(rows.every((x: any) => x.capturedAt)).toBe(true);
    console.log('E5-V S1 OK — history complete, sourced, newest-first');
  }, 60000);

  it('S2: filter excludes revoked, includes re-granted, honors purpose scoping', async () => {
    await grant(ctx.gB.id, 'marketing', 'booking');
    await request(app).post('/v1/marketing/consents').set(H()).send({
      guestId: ctx.gB.id,
      purpose: 'marketing',
      channel: 'email',
      status: 'revoked',
      source: 'unsubscribe',
    });
    // gD: granted newsletter, revoked marketing
    await grant(ctx.gD.id, 'newsletter', 'booking');
    await request(app).post('/v1/marketing/consents').set(H()).send({
      guestId: ctx.gD.id,
      purpose: 'marketing',
      channel: 'email',
      status: 'revoked',
      source: 'unsubscribe',
    });

    const filter = async (purpose: string) => {
      const r = await request(app)
        .post('/v1/marketing/consents/filter')
        .set(H())
        .send({
          guestIds: [ctx.gA.id, ctx.gB.id, ctx.gC.id, ctx.gD.id],
          purpose,
          channel: 'email',
        });
      expect(r.status).toBe(200);
      return r.body.data.allowed as string[];
    };
    expect(await filter('marketing')).toEqual([ctx.gA.id]); // revoked (gB, gD) + never (gC) excluded
    expect(await filter('newsletter')).toEqual([ctx.gD.id]); // gA never granted newsletter; gD's grant stands
    console.log('E5-V S2 OK — suppression + purpose scoping exact');
  }, 60000);

  it('S3: gate rejection writes consent.suppressed, visible in the audit trail', async () => {
    const g = await prisma.guest.create({
      data: {
        tenantId: ctx.t,
        firstName: 'E5',
        lastName: 'Gate',
        email: `e5-gate-${runId}@example.com`,
      },
    });
    const denied = await request(app)
      .post('/v1/marketing/consents/gate')
      .set(H())
      .send({ guestId: g.id, purpose: 'marketing', channel: 'email' });
    expect([403, 400]).toContain(denied.status);

    const audit = await request(app).get('/v1/marketing/consents/audit').set(H());
    expect(audit.status).toBe(200);
    expect(
      (audit.body.data as any[]).some(
        (row) => row.action === 'consent.suppressed' && JSON.stringify(row).includes(g.id)
      )
    ).toBe(true);
    console.log('E5-V S3 OK — suppression trail records the rejection');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
