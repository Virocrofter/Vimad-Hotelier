/* E1x-V — channel-mapping reflection check, live. Seeds a real ChannelConnection
 * pointed at a LOCAL HTTP receiver, pushes rates through the route, and asserts
 * the mapped payload (room type code, rate, currency, per-date) actually arrives.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import http from 'node:http';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
let app: any;
let agent: any;
const ctx: Record<string, any> = {};
let receiver: http.Server;
const received: { path: string; body: string }[] = [];

beforeAll(async () => {
  const mod: any = await import('../helpers/server.js');
  app = mod.buildTestApp?.() ?? mod.app;
  agent = await mod.registerTestAgent(app);
  const t = agent.tenantId;

  receiver = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ path: req.url ?? '/', body });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
  const port = (receiver.address() as any).port;

  const code = ('E1XC' + runId)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(-12);
  const prop = await prisma.property.create({ data: { tenantId: t, name: 'E1XC', code } });
  const rt = await prisma.roomType.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      name: 'E1XC RT',
      code: 'E1XCRT' + runId.toUpperCase().slice(-4),
    },
  });
  const plan = await prisma.ratePlan.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      roomTypeId: rt.id,
      name: 'E1XC Base',
      code: 'E1XCB' + runId.toUpperCase().slice(-4),
      baseRate: 1000,
      currency: 'ZAR',
      status: 'active',
    },
  });
  await prisma.channelConnection.create({
    data: {
      tenantId: t,
      propertyId: prop.id,
      provider: 'channex',
      hotelId: 'hotel-1',
      apiKey: 'test-key',
      endpoint: `http://127.0.0.1:${port}/rates`,
      status: 'active',
    },
  });

  const d0 = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  const d1 = new Date(Date.now() + 11 * 86400_000).toISOString().slice(0, 10);
  ctx.t = t;
  ctx.propId = prop.id;
  ctx.rtCode = rt.code;
  ctx.dateFrom = d0;
  ctx.dateTo = d1;
  console.log('E1x-V channel seeded, receiver on', port);
}, 90000);

describe('E1x-V channel reflection (live)', () => {
  it('push /v1/channel/push/rates delivers mapped rates to the connection endpoint', async () => {
    const r = await request(app)
      .post('/v1/channel/push/rates')
      .set('Authorization', 'Bearer ' + agent.token)
      .send({ propertyId: ctx.propId, dateFrom: ctx.dateFrom, dateTo: ctx.dateTo });
    expect(r.status).toBe(200);
    const pushed = r.body.data?.rates ?? [];
    expect(pushed.length).toBeGreaterThanOrEqual(2);

    expect(received.length).toBeGreaterThanOrEqual(1);
    const bodies = received.map((x) => x.body).join('\n');
    expect(bodies).toContain(ctx.rtCode);
    expect(bodies).toContain('1000');
    expect(bodies).toContain('ZAR');
    expect(bodies).toContain(ctx.dateFrom);
    console.log('E1x-V channel OK — mapped payload reflected to the connection endpoint');
  }, 60000);
});

afterAll(async () => {
  receiver?.close();
  await prisma.$disconnect();
});
