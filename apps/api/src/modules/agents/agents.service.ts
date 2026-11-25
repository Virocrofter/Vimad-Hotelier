/* apps/api/src/modules/agents/agents.service.ts — D8 travel-agent portal v1.
 * Agents are CorporateAccounts (isAgent) with contract terms; agent users are
 * User rows (role 'travel_agent') bound to the account. The portal is scoped
 * to the bound account: overview, bookings (with cutoff + net-rate pricing),
 * invoices (the shipped AR lifecycle, read-only). */

export async function overview(tenantId: string, agentAccountId: string) {
  const account = await prisma.corporateAccount.findFirst({
    where: { id: agentAccountId, tenantId, isAgent: true },
  });
  if (!account) throw new AppError(404, 'Agent account not found', 'NOT_FOUND');
  const [bookingCount, openInvoices, arrivals] = await Promise.all([
    prisma.reservation.count({ where: { tenantId, agentAccountId } }),
    prisma.arInvoice.aggregate({
      where: {
        tenantId,
        corporateAccountId: agentAccountId,
        status: { in: ['sent', 'partially_paid', 'overdue'] },
      },
      _sum: { total: true, amountPaid: true },
      _count: true,
    }),
    prisma.reservation.count({
      where: {
        tenantId,
        agentAccountId,
        arrivalDate: { gte: startOfToday() },
        status: 'confirmed',
      },
    }),
  ]);
  return {
    account: {
      id: account.id,
      name: account.name,
      commissionPct: account.commissionPct ? Number(account.commissionPct) : null,
      cutoffDays: account.cutoffDays,
      netRateDiscountPct: account.netRateDiscountPct ? Number(account.netRateDiscountPct) : null,
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
      paymentTermsDays: account.paymentTermsDays,
    },
    bookingCount,
    upcomingArrivals: arrivals,
    openInvoiceCount: openInvoices._count,
    openBalance: Number(openInvoices._sum.total ?? 0) - Number(openInvoices._sum.amountPaid ?? 0),
  };
}

export async function bookings(tenantId: string, agentAccountId: string) {
  const rows = await prisma.reservation.findMany({
    where: { tenantId, agentAccountId },
    include: { guest: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { arrivalDate: 'desc' },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    confirmationNumber: r.confirmationNumber,
    status: r.status,
    arrivalDate: r.arrivalDate,
    departureDate: r.departureDate,
    nights: r.nights,
    grossAmount: Number(r.totalAmount),
    guest: `${r.guest.firstName} ${r.guest.lastName}`,
  }));
}

export async function invoices(tenantId: string, agentAccountId: string) {
  const rows = await prisma.arInvoice.findMany({
    where: { tenantId, corporateAccountId: agentAccountId },
    orderBy: { issueDate: 'desc' },
    take: 200,
  });
  return rows.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    total: Number(inv.total),
    amountPaid: Number(inv.amountPaid),
    balance: Number(inv.total) - Number(inv.amountPaid),
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
  }));
}

/* Agent self-service booking: cutoff enforced from the contract; the stay is
 * priced at NET (gross x (1 - netRateDiscountPct)) when the contract sets one. */
export async function createBooking(
  tenantId: string,
  agentAccountId: string,
  input: {
    guestFirstName: string;
    guestLastName: string;
    guestEmail?: string;
    roomTypeId: string;
    arrivalDate: string;
    departureDate: string;
    grossAmount: number;
  }
) {
  const account = await prisma.corporateAccount.findFirst({
    where: { id: agentAccountId, tenantId, isAgent: true },
  });
  if (!account) throw new AppError(404, 'Agent account not found', 'NOT_FOUND');
  const arrival = new Date(input.arrivalDate + 'T12:00:00');
  const departure = new Date(input.departureDate + 'T12:00:00');
  if (
    Number.isNaN(arrival.getTime()) ||
    Number.isNaN(departure.getTime()) ||
    departure <= arrival
  ) {
    throw new AppError(400, 'Invalid date range', 'VALIDATION_ERROR');
  }
  const minArrival = addDays(startOfToday(), account.cutoffDays);
  if (arrival < minArrival) {
    throw new AppError(
      409,
      `Contract cutoff: bookings must arrive at least ${account.cutoffDays} day(s) out`,
      'CUTOFF_BREACHED'
    );
  }
  const roomType = await prisma.roomType.findFirst({ where: { id: input.roomTypeId, tenantId } });
  if (!roomType) throw new AppError(404, 'Room type not found', 'NOT_FOUND');

  const nights = Math.round((departure.getTime() - arrival.getTime()) / 86400_000);
  const discount = account.netRateDiscountPct ? Number(account.netRateDiscountPct) : 0;
  const netAmount = round2(Number(input.grossAmount) * (1 - discount / 100));

  const guest = await prisma.guest.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: input.guestEmail ?? `agent-${agentAccountId}@placeholder`,
      },
    },
    update: { firstName: input.guestFirstName, lastName: input.guestLastName },
    create: {
      tenantId,
      firstName: input.guestFirstName,
      lastName: input.guestLastName,
      email: input.guestEmail ?? `agent-${agentAccountId}@placeholder`,
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      tenantId,
      propertyId: roomType.propertyId,
      guestId: guest.id,
      roomTypeId: roomType.id,
      confirmationNumber: 'AGT-' + Date.now().toString(36).toUpperCase(),
      status: 'confirmed',
      source: 'travel_agent',
      agentAccountId,
      arrivalDate: arrival,
      departureDate: departure,
      nights,
      totalAmount: netAmount,
      balance: netAmount,
    },
  });
  return {
    id: reservation.id,
    confirmationNumber: reservation.confirmationNumber,
    status: reservation.status,
    grossAmount: Number(input.grossAmount),
    netAmount,
    nights,
  };
}

/* ─── helpers ─── */
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
