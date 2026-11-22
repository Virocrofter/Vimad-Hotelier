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

/* 6.6 — booking curve vs baseline: cumulative arrivals this period against
 * the same calendar window one year ago. Not a forecast — a comparison. */
export async function bookingCurve(tenantId: string, propertyId: string, days = 30) {
  const scope = { tenantId, propertyId, status: { in: ACTIVE } };
  const today = new Date();
  const periodStart = daysAgo(days);
  const baselineEnd = new Date(today.getTime() - 365 * 86400_000);
  const baselineStart = new Date(periodStart.getTime() - 365 * 86400_000);

  const [current, baseline] = await Promise.all([
    prisma.reservation.findMany({
      where: { ...scope, arrivalDate: { gte: periodStart, lte: today } },
      select: { arrivalDate: true },
    }),
    prisma.reservation.findMany({
      where: { ...scope, arrivalDate: { gte: baselineStart, lte: baselineEnd } },
      select: { arrivalDate: true },
    }),
  ]);

  const perDay = (rows: { arrivalDate: Date }[], start: Date, n: number) => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = day(new Date(r.arrivalDate));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    let cum = 0;
    const out: { offset: number; date: string; cumulative: number }[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(start.getTime() + i * 86400_000);
      const k = day(d);
      cum += counts.get(k) ?? 0;
      out.push({ offset: i, date: k, cumulative: cum });
    }
    return out;
  };

  const cur = perDay(current, periodStart, days + 1);
  const base = perDay(baseline, baselineStart, days + 1);
  return {
    generatedAt: new Date().toISOString(),
    days,
    series: cur.map((c, i) => ({
      offset: c.offset,
      date: c.date,
      cumulative: c.cumulative,
      baseline: base[i]?.cumulative ?? 0,
    })),
    totals: {
      current: cur[cur.length - 1]?.cumulative ?? 0,
      baseline: base[base.length - 1]?.cumulative ?? 0,
      delta: (cur[cur.length - 1]?.cumulative ?? 0) - (base[base.length - 1]?.cumulative ?? 0),
    },
  };
}

/* 6.3 — ledgers: guest/deposit/city + trial balance with the tie-out.
 * balanced === (sum of folio balances) equals (charges - payments) within a
 * cent — the C6′-V discipline made queryable. */
export async function biLedgers(tenantId: string, propertyId: string) {
  const folios = await prisma.folio.findMany({
    where: { tenantId, reservation: { propertyId }, status: 'open' },
    include: {
      reservation: {
        select: {
          confirmationNumber: true,
          guest: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const [charges, payments] = await Promise.all([
    prisma.folioItem.aggregate({
      where: { folio: { tenantId, reservation: { propertyId } } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { tenantId, propertyId, status: 'success', postedToFolio: true },
      _sum: { amountMinor: true },
    }),
  ]);
  const deposits = await prisma.payment.aggregate({
    where: { tenantId, propertyId, status: 'success', type: 'deposit' },
    _sum: { amountMinor: true },
    _count: { id: true },
  });

  const balances = folios.map((f) => Number(f.balance));
  const balanceTotal = balances.reduce((a, b) => a + b, 0);
  const chargeTotal = Number(charges._sum.amount ?? 0);
  const paymentTotal = Number(payments._sum.amountMinor ?? 0) / 100;
  const difference = Math.round((balanceTotal - (chargeTotal - paymentTotal)) * 100) / 100;

  return {
    generatedAt: new Date().toISOString(),
    guest: folios.map((f) => ({
      folioId: f.id,
      guest: f.reservation?.guest
        ? `${f.reservation.guest.firstName} ${f.reservation.guest.lastName}`
        : '—',
      confirmationNumber: f.reservation?.confirmationNumber ?? null,
      balance: Number(f.balance),
    })),
    deposit: {
      count: deposits._count?.id ?? 0,
      heldMinor: Number(deposits._sum?.amountMinor ?? 0),
    },
    city: [], // city-ledger transfers land with the ledger-tab drill-down pass
    trialBalance: { charges: chargeTotal, payments: paymentTotal, balanceTotal, difference },
    balanced: Math.abs(difference) < 0.01,
  };
}
