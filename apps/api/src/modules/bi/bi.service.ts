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
