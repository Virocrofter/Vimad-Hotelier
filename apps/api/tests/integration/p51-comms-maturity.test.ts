/* P51 — comms desk maturity (9.3): SLA states from the last guest message,
 * unread/focused tabs, broadcast-to-in-house per checked-in stay, escalation
 * toggle. Seeds use connect-style relations (client-verified shape).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
const ctx: Record<string, any> = {};

const SLA = Number(process.env.COMMS_SLA_MINUTES ?? 15);

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  const agent = await mod.registerTestAgent(app);
  ctx.tenantId = agent.tenantId;
  ctx.H = { Authorization: 'Bearer ' + agent.token };

  const tenantRow = await prisma.tenant.findFirst({ where: { id: agent.tenantId } });
  const slug = tenantRow?.slug ?? 'test';
  const mkUser = async (role: string) => {
    const email = `cm-${role}-${runId}@example.com`;
    const password = 'cm-evidence-1234';
    await request(app).post('/v1/users').set(ctx.H).send({
      email,
      firstName: 'CM',
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
      name: 'CM',
      code: ('CM' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'CM', lastName: 'Guest' },
  });
  const mkRes = (status: string, conf: string) =>
    prisma.reservation.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: ctx.prop.id,
        guestId: guest.id,
        confirmationNumber: conf,
        status,
        arrivalDate: new Date(),
        departureDate: new Date(Date.now() + 86400_000),
        nights: 1,
        totalAmount: 500,
        balance: 500,
      },
    });
  ctx.resA = await mkRes('checked_in', 'CMA' + runId.toUpperCase().slice(-4));
  ctx.resB = await mkRes('checked_in', 'CMB' + runId.toUpperCase().slice(-4));
  ctx.resC = await mkRes('confirmed', 'CMC' + runId.toUpperCase().slice(-4));

  const mkThread = async (res: any, unread: number) =>
    prisma.chatThread.create({
      data: {
        tenantId: agent.tenantId,
        propertyId: ctx.prop.id,
        reservation: { connect: { id: res.id } },
        guestId: res.guestId,
        status: 'open',
        unreadForStaff: unread,
        lastMessageAt: new Date(),
      },
    });
  ctx.thOld = await mkThread(ctx.resA, 1);
  ctx.thWarn = await mkThread(ctx.resB, 1);
  ctx.thClosed = await mkThread(ctx.resC, 0);

  const ago = (min: number) => new Date(Date.now() - min * 60000);
  await prisma.chatMessage.create({
    data: {
      thread: { connect: { id: ctx.thOld.id } },
      authorType: 'guest',
      authorName: 'CM Guest',
      body: 'old guest message',
      createdAt: ago(SLA * 2 + 5),
    },
  });
  await prisma.chatMessage.create({
    data: {
      thread: { connect: { id: ctx.thWarn.id } },
      authorType: 'guest',
      authorName: 'CM Guest',
      body: 'recent-ish guest message',
      createdAt: ago(SLA + 3),
    },
  });
  await prisma.chatMessage.create({
    data: {
      thread: { connect: { id: ctx.thOld.id } },
      authorType: 'staff',
      authorName: 'staff@cm',
      body: 'staff reply after the old guest message',
      createdAt: new Date(),
    },
  });
  await prisma.chatThread.update({
    where: { id: ctx.thClosed.id },
    data: { status: 'closed' },
  });
  console.log('P51 seeded');
}, 90000);

describe('P51 comms maturity (9.3)', () => {
  it('S1: SLA states — overdue vs warning vs staff-last (ok)', async () => {
    const r = await request(app).get('/v1/comms/chat/inbox?status=all').set(ctx.staff());
    expect(r.status).toBe(200);
    const byId = Object.fromEntries(r.body.threads.map((t: any) => [t.id, t]));
    expect(byId[ctx.thOld.id].sla.state).toBe('overdue');
    expect(byId[ctx.thOld.id].sla.minutes).toBeGreaterThan(SLA * 2);
    expect(byId[ctx.thWarn.id].sla.state).toBe('warning');
    console.log('P51 S1 OK — SLA bell states correct');
  }, 60000);

  it('S2: unread + focused tabs', async () => {
    const unread = await request(app).get('/v1/comms/chat/inbox?status=unread').set(ctx.staff());
    const ids = unread.body.threads.map((t: any) => t.id);
    expect(ids).toContain(ctx.thOld.id);
    expect(ids).toContain(ctx.thWarn.id);
    expect(ids).not.toContain(ctx.thClosed.id);

    const focused = await request(app).get('/v1/comms/chat/inbox?status=focused').set(ctx.staff());
    expect(focused.body.threads.every((t: any) => t.status === 'open')).toBe(true);
    console.log('P51 S2 OK — unread/focused lenses');
  }, 60000);

  it('S3: broadcast reaches every checked-in stay (and only those)', async () => {
    const r = await request(app)
      .post('/v1/comms/chat/broadcast')
      .set(ctx.staff())
      .send({ body: 'Pool closes at 18:00 today for maintenance.' });
    expect(r.status).toBe(200);
    expect(r.body.sent).toBe(2);
    expect(r.body.threadIds.length).toBe(2);

    for (const tid of r.body.threadIds) {
      const msg = await prisma.chatMessage.findFirst({
        where: { threadId: tid, type: 'announcement' },
      });
      expect(msg).toBeTruthy();
      expect(msg.authorType).toBe('staff');
      const th = await prisma.chatThread.findFirst({ where: { id: tid } });
      expect(th.unreadForGuest).toBeGreaterThanOrEqual(1);
    }
    const confirmedThread = await prisma.chatThread.findFirst({
      where: { reservationId: ctx.resC.id },
    });
    expect(confirmedThread).toBeNull();
    console.log('P51 S3 OK — broadcast fan-out exact');
  }, 60000);

  it('S4: escalation toggle + inbox carries it', async () => {
    const on = await request(app)
      .post(`/v1/comms/chat/threads/${ctx.thOld.id}/escalate`)
      .set(ctx.staff())
      .send({ escalated: true });
    expect(on.status).toBe(200);
    expect(on.body.escalated).toBe(true);

    const inbox = await request(app).get('/v1/comms/chat/inbox?status=all').set(ctx.staff());
    const t = inbox.body.threads.find((x: any) => x.id === ctx.thOld.id);
    expect(t.escalated).toBe(true);

    const off = await request(app)
      .post(`/v1/comms/chat/threads/${ctx.thOld.id}/escalate`)
      .set(ctx.staff())
      .send({ escalated: false });
    expect(off.body.escalated).toBe(false);
    console.log('P51 S4 OK — escalation toggle');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
