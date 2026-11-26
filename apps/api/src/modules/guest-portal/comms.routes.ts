/* apps/api/src/modules/guest-portal/comms.routes.ts — staff-side comms desk.
 * Mounted at /v1/comms behind staff auth.
 *   GET   /comms/chat/inbox                    → threads with unread counts + last message
 *   GET   /comms/chat/threads/:id/messages
 *   POST  /comms/chat/threads/:id/messages     → staff reply (guest unread++)
 *   POST  /comms/chat/threads/:id/read
 *   PATCH /comms/chat/threads/:id               → {status: open|closed}
 *   GET   /comms/reviews?status=pending         → moderation queue
 *   PATCH /comms/reviews/:id                    → approve/reject
 *   GET   /comms/announcements · POST /comms/announcements
 */
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requirePermission } from '../auth/auth.middleware.js';
import { prisma } from '../../common/prisma.js';
import { emitToReservation } from '../../common/socket.js';
import { AppError } from '../../common/errors.js';

export const commsRouter = Router();
commsRouter.use(authMiddleware);

const TENANT = (req: any) => req.auth.tenantId as string;

const SLA_MINUTES = Number(process.env.COMMS_SLA_MINUTES ?? 15);
type SlaState = 'ok' | 'warning' | 'overdue';
function slaState(minutes: number | null): SlaState {
  if (minutes === null) return 'ok';
  if (minutes > SLA_MINUTES * 2) return 'overdue';
  if (minutes > SLA_MINUTES) return 'warning';
  return 'ok';
}

commsRouter.get('/chat/inbox', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const status = String((req.query as { status?: string }).status ?? 'open');
    // 9.3: unread = guest waiting on staff; focused = open, overdue-first.
    const where =
      status === 'unread'
        ? { tenantId: TENANT(req), unreadForStaff: { gt: 0 } }
        : {
            tenantId: TENANT(req),
            ...(status === 'all' || status === 'focused' ? {} : { status }),
          };
    const threads = await prisma.chatThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });

    const withLast = await Promise.all(
      threads.map(async (t) => {
        const last = await prisma.chatMessage.findFirst({
          where: { threadId: t.id },
          orderBy: { createdAt: 'desc' },
        });
        const reservation = await prisma.reservation.findFirst({
          where: { id: t.reservationId },
          select: { confirmationNumber: true },
        });
        const guest = await prisma.guest.findFirst({
          where: { id: t.guestId },
          select: { firstName: true, lastName: true },
        });
        const lastGuest = await prisma.chatMessage.findFirst({
          where: { threadId: t.id, authorType: 'guest' },
          orderBy: { createdAt: 'desc' },
        });
        const minutes = lastGuest
          ? Math.floor((Date.now() - new Date(lastGuest.createdAt).getTime()) / 60000)
          : null;
        return {
          ...t,
          sla: { state: slaState(minutes), minutes },
          guestName: guest ? `${guest.firstName} ${guest.lastName}` : 'Guest',
          confirmationNumber: reservation?.confirmationNumber ?? '',
          lastMessage: last
            ? { body: last.body, authorType: last.authorType, createdAt: last.createdAt }
            : null,
        };
      })
    );

    res.json({ threads: withLast });
  } catch (err) {
    next(err);
  }
});

commsRouter.get(
  '/chat/threads/:id/messages',
  requirePermission('ticket', 'read'),
  async (req, res, next) => {
    try {
      const thread = await prisma.chatThread.findFirst({
        where: { id: String(req.params.id), tenantId: TENANT(req) },
      });
      if (!thread) throw new AppError(404, 'Thread not found', 'NOT_FOUND');

      await prisma.chatThread.update({
        where: { id: thread.id },
        data: { unreadForStaff: 0 },
      });

      const messages = await prisma.chatMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });

      res.json({ thread, messages });
    } catch (err) {
      next(err);
    }
  }
);

const staffMessageSchema = z.object({
  body: z.string().min(1).max(2000),
  type: z.enum(['text', 'offer']).optional(),
  payload: z.record(z.unknown()).optional(),
});

commsRouter.post(
  '/chat/threads/:id/messages',
  requirePermission('ticket', 'update'),
  async (req, res, next) => {
    try {
      const thread = await prisma.chatThread.findFirst({
        where: { id: String(req.params.id), tenantId: TENANT(req) },
      });
      if (!thread) throw new AppError(404, 'Thread not found', 'NOT_FOUND');

      const input = staffMessageSchema.parse(req.body ?? {});
      const message = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          authorType: 'staff',
          authorId: req.auth.userId,
          authorName: req.auth.email ?? 'Staff',
          body: input.body,
          type: input.type ?? 'text',
          payload: input.payload ? JSON.parse(JSON.stringify(input.payload)) : undefined,
        },
      });

      await prisma.chatThread.update({
        where: { id: thread.id },
        data: {
          lastMessageAt: message.createdAt,
          unreadForGuest: { increment: 1 },
          unreadForStaff: 0,
        },
      });

      emitToReservation(thread.reservationId, 'chat:message', { threadId: thread.id, message });

      res.json({ message });
    } catch (err) {
      next(err);
    }
  }
);

commsRouter.post(
  '/chat/threads/:id/read',
  requirePermission('ticket', 'read'),
  async (req, res, next) => {
    try {
      await prisma.chatThread.updateMany({
        where: { id: String(req.params.id), tenantId: TENANT(req) },
        data: { unreadForStaff: 0 },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

const threadPatchSchema = z.object({ status: z.enum(['open', 'closed']) });

// 9.3: broadcast to in-house — one announcement message per checked-in guest.
commsRouter.post(
  '/chat/broadcast',
  requirePermission('ticket', 'update'),
  async (req, res, next) => {
    try {
      const input = z
        .object({ body: z.string().min(3).max(2000), propertyId: z.string().nullish() })
        .parse(req.body ?? {});
      const stays = await prisma.reservation.findMany({
        where: {
          tenantId: TENANT(req),
          status: 'checked_in',
          ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        },
        select: { id: true, guestId: true, propertyId: true },
        take: 500,
      });

      const threadIds: string[] = [];
      for (const stay of stays) {
        let thread = await prisma.chatThread.findFirst({ where: { reservationId: stay.id } });
        if (!thread) {
          thread = await prisma.chatThread.create({
            data: {
              tenantId: TENANT(req),
              propertyId: stay.propertyId,
              reservationId: stay.id,
              guestId: stay.guestId,
              status: 'open',
              lastMessageAt: new Date(),
            },
          });
        }
        await prisma.chatMessage.create({
          data: {
            threadId: thread.id,
            authorType: 'staff',
            authorId: req.auth.userId,
            authorName: req.auth.email ?? 'Staff',
            body: input.body,
            type: 'announcement',
          },
        });
        await prisma.chatThread.update({
          where: { id: thread.id },
          data: { unreadForGuest: { increment: 1 }, lastMessageAt: new Date() },
        });
        threadIds.push(thread.id);
        emitToReservation(stay.id, 'chat:message', { threadId: thread.id, broadcast: true });
      }
      res.json({ sent: threadIds.length, threadIds });
    } catch (err) {
      next(err);
    }
  }
);

// 9.3: escalation toggle.
commsRouter.post(
  '/chat/threads/:id/escalate',
  requirePermission('ticket', 'update'),
  async (req, res, next) => {
    try {
      const input = z.object({ escalated: z.boolean() }).parse(req.body ?? {});
      const updated = await prisma.chatThread.updateMany({
        where: { id: String(req.params.id), tenantId: TENANT(req) },
        data: { escalated: input.escalated },
      });
      if (updated.count === 0) throw new AppError(404, 'Thread not found', 'NOT_FOUND');
      res.json({ ok: true, escalated: input.escalated });
    } catch (err) {
      next(err);
    }
  }
);

commsRouter.patch(
  '/chat/threads/:id',
  requirePermission('ticket', 'update'),
  async (req, res, next) => {
    try {
      const input = threadPatchSchema.parse(req.body ?? {});
      const updated = await prisma.chatThread.updateMany({
        where: { id: String(req.params.id), tenantId: TENANT(req) },
        data: { status: input.status },
      });
      if (updated.count === 0) throw new AppError(404, 'Thread not found', 'NOT_FOUND');
      res.json({ ok: true, status: input.status });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Review moderation ───

commsRouter.get('/reviews', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const status = String((req.query as { status?: string }).status ?? 'pending');
    const reviews = await prisma.review.findMany({
      where: { tenantId: TENANT(req), ...(status === 'all' ? {} : { status }) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
});

const reviewPatchSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  moderationNote: z.string().max(300).optional(),
});

commsRouter.patch('/reviews/:id', requirePermission('ticket', 'manage'), async (req, res, next) => {
  try {
    const input = reviewPatchSchema.parse(req.body ?? {});
    const updated = await prisma.review.updateMany({
      where: { id: String(req.params.id), tenantId: TENANT(req) },
      data: {
        status: input.status,
        moderationNote: input.moderationNote ?? null,
        moderatedAt: new Date(),
        moderatedById: req.auth.userId,
      },
    });
    if (updated.count === 0) throw new AppError(404, 'Review not found', 'NOT_FOUND');
    res.json({ ok: true, status: input.status });
  } catch (err) {
    next(err);
  }
});

// ─── Announcements composer ───

commsRouter.get(
  '/announcements',
  requirePermission('announcement', 'manage'),
  async (req, res, next) => {
    try {
      const announcements = await prisma.announcement.findMany({
        where: { tenantId: TENANT(req) },
        orderBy: { publishAt: 'desc' },
        take: 50,
      });
      res.json({ announcements });
    } catch (err) {
      next(err);
    }
  }
);

const announcementSchema = z.object({
  title: z.string().min(3).max(140),
  body: z.string().min(3).max(2000),
  propertyId: z.string().nullish(),
  publishAt: z.string().nullish(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
});

commsRouter.post(
  '/announcements',
  requirePermission('announcement', 'manage'),
  async (req, res, next) => {
    try {
      const input = announcementSchema.parse(req.body ?? {});
      const announcement = await prisma.announcement.create({
        data: {
          tenantId: TENANT(req),
          propertyId: input.propertyId ?? null,
          title: input.title,
          body: input.body,
          status: input.status,
          publishAt: input.publishAt ? new Date(input.publishAt) : new Date(),
          createdById: req.auth.userId,
        },
      });
      res.json({ announcement });
    } catch (err) {
      next(err);
    }
  }
);
