/* apps/api/src/modules/marketing/winback.routes.ts
 * H3: win-back / rebooking automation — the first campaign workflow, built
 * directly on E5 consent enforcement (roadmap: H3 only after E5, which is
 * verified by P7).
 *
 * Pipeline per run:
 *   candidates -> E5 send-time gate (per recipient) -> duplicate-send
 *   suppression window -> handoff to the email pipeline as an email_logs
 *   row (template 'win-back', status 'queued').
 *
 * Suppression rules (roadmap marketing checklist):
 *  - blacklisted guests are never contacted;
 *  - guests without an email are skipped;
 *  - the E5 gate decides marketing consent per purpose+channel (P7);
 *  - a guest is not re-contacted within `suppressionDays` of the last
 *    win-back send (duplicate-send rule) — judged on email_logs rows,
 *    so the rule holds across runs and restarts.
 * `dryRun` evaluates everything and changes nothing.
 *
 * Follow-up (attribution, C8'): log MarketingEvent rows against a
 * MarketingCampaign so sends/opens/bookings attribute to the workflow.
 */
import { Router, type Request, type Response } from 'express';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';
import { isSendAllowed } from './marketing.consent.routes.js';

export const winbackRouter = Router();
winbackRouter.use(authMiddleware, tenantScope);

function tenantOf(req: Request): string | undefined {
  return ((req as any).user?.tenantId ?? (req as any).tenantId) as string | undefined;
}

function monthsAgo(m: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d;
}

// POST /v1/marketing/winback/run
winbackRouter.post('/winback/run', async (req: Request, res: Response) => {
  const tenantId = tenantOf(req)!;
  const body = (req.body ?? {}) as any;
  const minMonthsAgo = Number(body.minMonthsAgo ?? 6);
  const maxMonthsAgo = Number(body.maxMonthsAgo ?? 12);
  const suppressionDays = Number(body.suppressionDays ?? 90);
  const dryRun = body.dryRun === true;
  if (![minMonthsAgo, maxMonthsAgo, suppressionDays].every((n) => Number.isFinite(n) && n >= 0)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'window values must be non-negative numbers' },
    });
  }
  if (minMonthsAgo >= maxMonthsAgo) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'minMonthsAgo must be less than maxMonthsAgo' },
    });
  }

  const oldestDeparture = monthsAgo(maxMonthsAgo); // window: [oldest, newest]
  const newestDeparture = monthsAgo(minMonthsAgo);
  const suppressionSince = new Date(Date.now() - suppressionDays * 86400000);

  // Candidates: guests whose LAST completed stay departed inside the window.
  const completed = await prisma.reservation.findMany({
    where: { tenantId, status: 'checked_out', departureDate: { gte: oldestDeparture } },
    select: {
      guestId: true,
      departureDate: true,
      guest: { select: { email: true, blacklisted: true, firstName: true, lastName: true } },
    },
  });
  const lastDeparture = new Map<
    string,
    { dep: Date; email: string | null; blacklisted: boolean; name: string }
  >();
  for (const r of completed) {
    const cur = lastDeparture.get(r.guestId);
    if (!cur || r.departureDate > cur.dep) {
      lastDeparture.set(r.guestId, {
        dep: r.departureDate,
        email: r.guest.email,
        blacklisted: r.guest.blacklisted,
        name: r.guest.firstName + ' ' + r.guest.lastName,
      });
    }
  }

  const skipped = { noEmail: 0, blacklisted: 0, recentStay: 0 };
  const candidates: { guestId: string; email: string; name: string; lastDeparture: Date }[] = [];
  for (const [guestId, v] of lastDeparture) {
    if (v.dep < oldestDeparture || v.dep > newestDeparture) {
      skipped.recentStay++; // last stay too recent or outside the recall window
      continue;
    }
    if (!v.email) {
      skipped.noEmail++;
      continue;
    }
    if (v.blacklisted) {
      skipped.blacklisted++;
      continue;
    }
    candidates.push({ guestId, email: v.email, name: v.name, lastDeparture: v.dep });
  }

  // Per-recipient pipeline: E5 gate, then duplicate-send suppression.
  const suppressed = { noConsent: 0, recentContact: 0 };
  let sent = 0;
  const creates: Promise<unknown>[] = [];
  for (const c of candidates) {
    const gate = await isSendAllowed(tenantId, c.guestId, 'marketing', 'email');
    if (!gate.allowed) {
      suppressed.noConsent++;
      continue;
    }
    const prior = await prisma.emailLog.findFirst({
      where: { tenantId, to: c.email, template: 'win-back', createdAt: { gte: suppressionSince } },
    });
    if (prior) {
      suppressed.recentContact++;
      continue;
    }
    sent++;
    if (!dryRun) {
      creates.push(
        prisma.emailLog.create({
          data: {
            tenantId,
            to: c.email,
            subject: 'We would love to welcome you back',
            template: 'win-back',
            status: 'queued',
            relatedType: 'guest',
            relatedId: c.guestId,
            payload: { guestId: c.guestId, guestName: c.name, lastDeparture: c.lastDeparture },
          },
        })
      );
    }
  }
  if (!dryRun) await Promise.all(creates);

  return res.json({
    data: {
      evaluated: candidates.length,
      sent,
      suppressed,
      skipped,
      windowMonths: [minMonthsAgo, maxMonthsAgo],
      suppressionDays,
      dryRun,
    },
  });
});

// H3-V: record an open (ESP callback / tracking hit). First event wins.
winbackRouter.post('/winback/record-open', async (req: Request, res: Response) => {
  const tenantId = tenantOf(req)!;
  const { emailLogId } = (req.body ?? {}) as any;
  if (!emailLogId)
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'emailLogId is required' } });
  await prisma.emailLog.updateMany({
    where: { id: String(emailLogId), tenantId, template: 'win-back', openedAt: null },
    data: { openedAt: new Date() },
  });
  return res.json({ data: { recorded: true } });
});

// H3-V: the run log with outcomes — each win-back send with its open timestamp
// and rebook attribution (guest's next non-cancelled reservation after send).
winbackRouter.get('/winback/runs', async (req: Request, res: Response) => {
  const tenantId = tenantOf(req)!;
  const rows = await prisma.emailLog.findMany({
    where: { tenantId, template: 'win-back' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const out = [];
  for (const row of rows) {
    const guestId = (row.payload as any)?.guestId ?? row.relatedId;
    let rebooked: { at: Date; reservationId: string } | null = null;
    if (guestId) {
      const r = await prisma.reservation.findFirst({
        where: {
          tenantId,
          guestId: String(guestId),
          createdAt: { gt: row.createdAt },
          status: { not: 'cancelled' },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (r) rebooked = { at: r.createdAt, reservationId: r.id };
    }
    out.push({
      id: row.id,
      to: row.to,
      guestId,
      sentAt: row.createdAt,
      openedAt: row.openedAt,
      rebookedAt: rebooked?.at ?? null,
      rebookedReservationId: rebooked?.reservationId ?? null,
      status: row.status,
    });
  }
  return res.json({ data: out });
});
