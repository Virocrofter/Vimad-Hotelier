/* Phase 6.1 — C2′ BI hub: one query surface, six curated families. Each
 * family is a tenant+property-scoped aggregation; the hub page renders them
 * as cards. Delegation to the v2 read-models refines in the next pass. */
import { prisma } from '../../common/prisma.js';

const day = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86400_000);
const ACTIVE = ['confirmed', 'checked_in'];

export async function biFamilies(tenantId: string, propertyId: string) {
  const scope = { tenantId, propertyId };
  const today = day(new Date());

  const [
    arrivalsToday,
    departuresToday,
    stayovers,
    rooms,
    inHouse,
    revenueAgg,
    payMix,
    arAgg,
    blocked,
    upcoming,
    recent,
  ] = await Promise.all([
    prisma.reservation.count({
      where: { ...scope, arrivalDate: new Date(today), status: { in: ACTIVE } },
    }),
    prisma.reservation.count({
      where: { ...scope, departureDate: new Date(today), status: 'checked_in' },
    }),
    prisma.reservation.count({ where: { ...scope, status: 'checked_in' } }),
    prisma.room.count({ where: scope }),
    prisma.reservation.count({ where: { ...scope, status: 'checked_in' } }),
    prisma.reservation.aggregate({
      where: { ...scope, status: { in: ACTIVE }, arrivalDate: { gte: daysAgo(30) } },
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ['channel'],
      where: { ...scope, createdAt: { gte: daysAgo(30) }, status: 'success' },
      _count: { id: true },
      _sum: { amountMinor: true },
    }),
    prisma.arInvoice.groupBy({
      by: ['status'],
      where: { tenantId }, // AR is tenant-scoped (accounts span properties)
      _count: { id: true },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.room.groupBy({ by: ['serviceStatus'], where: scope, _count: { id: true } }),
    prisma.reservation.count({
      where: {
        ...scope,
        arrivalDate: { gte: new Date(today), lte: daysAhead(7) },
        status: { in: ACTIVE },
      },
    }),
    prisma.reservation.count({
      where: {
        ...scope,
        arrivalDate: { gte: daysAgo(7), lt: new Date(today) },
        status: { in: ACTIVE },
      },
    }),
  ]);

  const occupancyPct = rooms > 0 ? Math.round((inHouse / rooms) * 100) : 0;
  const adr =
    inHouse > 0 ? Math.round(Number(revenueAgg._sum.totalAmount ?? 0) / Math.max(1, inHouse)) : 0;

  return {
    generatedAt: new Date().toISOString(),
    dailySummary: { arrivalsToday, departuresToday, stayovers, occupancyPct, adr },
    occupancyRevenue: {
      rooms,
      inHouse,
      occupancyPct,
      revenue30d: Number(revenueAgg._sum.totalAmount ?? 0),
      adr,
    },
    paymentsMix: payMix.map((p) => ({
      channel: p.channel,
      count: p._count.id,
      totalMinor: Number(p._sum.amountMinor ?? 0),
    })),
    arAging: arAgg.map((a) => ({
      status: a.status,
      count: (a._count as any)?.id ?? 0,
      total: Number((a._sum as any)?.total ?? 0),
      amountPaid: Number((a._sum as any)?.amountPaid ?? 0),
    })),
    blockedRooms: blocked.map((b) => ({ serviceStatus: b.serviceStatus, count: b._count.id })),
    pickup: { next7dArrivals: upcoming, last7dArrivals: recent, delta: upcoming - recent },
  };
}

/* 6.4 — Daily Briefing: rules-generated template sentences over live data.
 * Every sentence names its rule + carries the numbers it cites — legible,
 * and zero hallucination by construction (no generative model). */
export async function biBriefing(tenantId: string, propertyId: string) {
  const scope = { tenantId, propertyId };
  const today = day(new Date());

  const [arrivals, departures, unpaid, pickupRow, occ, blockedCount, overdueAr] = await Promise.all(
    [
      prisma.reservation.count({
        where: { ...scope, arrivalDate: new Date(today), status: { in: ACTIVE } },
      }),
      prisma.reservation.count({
        where: { ...scope, departureDate: new Date(today), status: 'checked_in' },
      }),
      prisma.reservation.count({ where: { ...scope, status: 'checked_in', balance: { gt: 0 } } }),
      prisma.reservation.count({
        where: {
          ...scope,
          arrivalDate: { gte: new Date(today), lte: daysAhead(7) },
          status: { in: ACTIVE },
        },
      }),
      (async () => {
        const [rooms, inHouse] = await Promise.all([
          prisma.room.count({ where: scope }),
          prisma.reservation.count({ where: { ...scope, status: 'checked_in' } }),
        ]);
        return rooms > 0 ? Math.round((inHouse / rooms) * 100) : 0;
      })(),
      prisma.room.count({ where: { ...scope, serviceStatus: { not: 'active' } } }),
      prisma.arInvoice.count({ where: { tenantId, status: 'overdue' } }),
    ]
  );
  const lastWeek = await prisma.reservation.count({
    where: {
      ...scope,
      arrivalDate: { gte: daysAgo(7), lt: new Date(today) },
      status: { in: ACTIVE },
    },
  });
  const delta = pickupRow - lastWeek;

  const sentences = [
    {
      rule: 'pickup',
      text: `Pickup ${delta >= 0 ? '+' : ''}${delta} arrivals vs last week (${pickupRow} next 7d)`,
      kind: delta >= 0 ? 'positive' : 'warning',
      data: { next7d: pickupRow, last7d: lastWeek, delta },
    },
    {
      rule: 'arrivals',
      text:
        arrivals > 0
          ? `${arrivals} arrival${arrivals === 1 ? '' : 's'} today`
          : 'No arrivals today',
      kind: 'info',
      data: { arrivalsToday: arrivals },
    },
    {
      rule: 'departures',
      text:
        departures > 0
          ? `${departures} departure${departures === 1 ? '' : 's'} today — check folios at checkout`
          : 'No departures today',
      kind: departures > 0 ? 'action' : 'info',
      data: { departuresToday: departures },
    },
    {
      rule: 'unpaid',
      text:
        unpaid > 0
          ? `${unpaid} in-house folio${unpaid === 1 ? '' : 's'} carry a balance`
          : 'All in-house folios settled',
      kind: unpaid > 0 ? 'warning' : 'positive',
      data: { unpaidInHouse: unpaid },
    },
    {
      rule: 'occupancy',
      text: `Occupancy ${occ}% tonight`,
      kind: 'info',
      data: { occupancyPct: occ },
    },
    {
      rule: 'blocked',
      text:
        blockedCount > 0
          ? `${blockedCount} room${blockedCount === 1 ? '' : 's'} out of service`
          : 'No rooms blocked',
      kind: blockedCount > 0 ? 'warning' : 'positive',
      data: { blocked: blockedCount },
    },
    {
      rule: 'ar_overdue',
      text:
        overdueAr > 0
          ? `${overdueAr} AR invoice${overdueAr === 1 ? '' : 's'} overdue`
          : 'AR clean — nothing overdue',
      kind: overdueAr > 0 ? 'warning' : 'positive',
      data: { overdueAr },
    },
  ];
  return { generatedAt: new Date().toISOString(), propertyId, sentences };
}
