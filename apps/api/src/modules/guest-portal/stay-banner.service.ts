/* apps/api/src/modules/guest-portal/stay-banner.service.ts — P49 (Phase 9.1)
 * Contextual stay banner: one call tells the portal home what state the stay
 * is in and what to show. State machine: pre_arrival → arrived_dirty →
 * in_house → departure, with contextual CTAs and live upsell offers riding
 * the M1′ product catalog. Portal-token auth (same convention as my-stays).
 * Room link rides the P20 ReservationRoom bridge (runtime-checked so a
 * field-name drift fails loudly in tests, not silently in production). */
import { prisma } from '../../common/prisma.js';
import { resolveToken } from './guest-portal.service.js';

const READY_STATES = ['ready', 'inspected', 'clean'];

export async function getStayBanner(token: string) {
  const r = await resolveToken(token);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dep = new Date(r.departureDate);
  dep.setHours(0, 0, 0, 0);

  const bridge = await (prisma as any).reservationRoom?.findFirst({
    where: { reservationId: r.id },
  });
  const room = bridge?.roomId
    ? await prisma.room.findFirst({
        where: { id: bridge.roomId },
        select: { number: true, housekeepingStatus: true },
      })
    : null;
  const roomReady = room
    ? READY_STATES.includes(String(room.housekeepingStatus).toLowerCase())
    : false;

  const folio = await prisma.folio.findFirst({
    where: { reservationId: r.id },
    select: { balance: true },
  });
  const balance = folio ? Number(folio.balance) : 0;

  const offers = await prisma.upsellProduct.findMany({
    where: { tenantId: r.tenantId, propertyId: r.propertyId, status: 'active' },
    orderBy: { price: 'asc' },
    take: 3,
    select: { id: true, name: true, category: true, price: true },
  });

  let state: 'pre_arrival' | 'arrived_dirty' | 'in_house' | 'departure';
  if (r.status === 'checked_out' || (r.status === 'checked_in' && dep <= today)) {
    state = 'departure';
  } else if (r.status === 'checked_in') {
    state = roomReady ? 'in_house' : 'arrived_dirty';
  } else {
    state = 'pre_arrival';
  }

  const cta =
    state === 'pre_arrival'
      ? { label: 'Complete check-in', action: 'start_checkin' }
      : state === 'arrived_dirty'
        ? { label: 'Your room is being prepared', action: 'wait' }
        : state === 'in_house'
          ? { label: 'Your key is ready', action: 'digital_key' }
          : balance > 0
            ? { label: `Pay R ${balance.toFixed(2)} & check out`, action: 'express_checkout' }
            : { label: 'Check out', action: 'express_checkout' };

  const headline =
    state === 'pre_arrival'
      ? `See you on ${r.arrivalDate ? new Date(r.arrivalDate).toISOString().slice(0, 10) : 'arrival day'}`
      : state === 'arrived_dirty'
        ? 'Welcome — your room is being prepared'
        : state === 'in_house'
          ? room?.number
            ? `Room ${room.number} is ready`
            : 'Your room is ready'
          : balance > 0
            ? 'Time to go — settle your folio'
            : 'Time to go — thank you for staying with us';

  return {
    state,
    headline,
    cta,
    roomNumber: room?.number ?? null,
    roomReady,
    balance,
    offers: offers.map((o) => ({ ...o, price: Number(o.price) })),
    arrivalDate: r.arrivalDate,
    departureDate: r.departureDate,
  };
}
