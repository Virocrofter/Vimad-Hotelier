/* P70 — room-board occupant payload carries reservationId + folio balance,
 * so the tape-chart overlay renders money status without a second hop. */
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
  ctx.H = { Authorization: 'Bearer ' + agent.token };

  ctx.prop = await prisma.property.create({
    data: {
      tenantId: agent.tenantId,
      name: 'RB',
      code: ('RB' + runId)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(-12),
    },
  });
  ctx.rt = await prisma.roomType.create({
    data: {
      tenant: { connect: { id: agent.tenantId } },
      property: { connect: { id: ctx.prop.id } },
      name: 'RB RT',
      code: 'RBRT' + runId.toUpperCase().slice(-4),
    },
  });
  ctx.room = await prisma.room.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      roomTypeId: ctx.rt.id,
      number: 'RB-1',
      housekeepingStatus: 'ready',
      serviceStatus: 'active',
    },
  });
  const guest = await prisma.guest.create({
    data: { tenantId: agent.tenantId, firstName: 'RB', lastName: 'Guest' },
  });
  ctx.res = await prisma.reservation.create({
    data: {
      tenantId: agent.tenantId,
      propertyId: ctx.prop.id,
      guestId: guest.id,
      confirmationNumber: 'RB' + runId.toUpperCase().slice(-6),
      status: 'checked_in',
      arrivalDate: new Date(),
      departureDate: new Date(Date.now() + 86400_000),
      nights: 1,
      totalAmount: 800,
      balance: 800,
    },
  });
  await prisma.folio.create({
    data: {
      tenantId: agent.tenantId,
      reservationId: ctx.res.id,
      totalCharges: 800,
      totalPayments: 0,
      balance: 800,
    },
  });
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  await prisma.reservationStay.create({
    data: { roomId: ctx.room.id, reservationId: ctx.res.id, date: today, rate: 800 },
  });
  console.log('P70 seeded');
}, 90000);

describe('P70 room-board overlay payload', () => {
  it('S1: occupant carries reservationId + balance', async () => {
    const r = await request(app).get(`/v1/room-board?propertyId=${ctx.prop.id}`).set(ctx.H());
    expect(r.status).toBe(200);
    const room = r.body.data.rooms.find((x: any) => x.id === ctx.room.id);
    expect(room.occupant.reservationId).toBe(ctx.res.id);
    expect(room.occupant.confirmationNumber).toBe(ctx.res.confirmationNumber);
    expect(room.occupant.balance).toBe(800);
    expect(room.occupant.status).toBe('checked_in');
    console.log('P70 S1 OK — overlay payload complete');
  }, 60000);

  it('S2: the drawer route carries the same enriched occupant', async () => {
    const r = await request(app).get(`/v1/room-board/${ctx.room.id}`).set(ctx.H());
    expect(r.status).toBe(200);
    expect(r.body.data.occupant.balance).toBe(800);
    console.log('P70 S2 OK — drawer parity');
  }, 60000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
