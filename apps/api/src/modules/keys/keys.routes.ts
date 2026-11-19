/* apps/api/src/modules/keys/keys.routes.ts — [KEYS] V1-prime: room key/card
 * issuance registry. Issue at check-in, return at check-out, mark lost.
 * One ACTIVE issuance per room (409 on conflict). Permissions ride the task
 * pair until a dedicated keys permission is seeded. */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  authMiddleware,
  requirePermission,
  tenantScope,
  type AuthenticatedRequest,
} from '../auth/auth.middleware.js';
import { validateBody, validateQuery } from '../../common/validate.js';
import { prisma } from '../../common/prisma.js';

export const keysRouter = Router();
keysRouter.use(authMiddleware, tenantScope);

const listQuerySchema = z.object({
  propertyId: z.string().optional(),
  status: z.string().optional(),
});
const issueSchema = z.object({
  roomId: z.string().min(1),
  reservationId: z.string().optional(),
  guestName: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});

keysRouter.get(
  '/',
  requirePermission('task', 'read'),
  validateQuery(listQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as AuthenticatedRequest).auth.tenantId;
      const q = req.validatedQuery as { propertyId?: string; status?: string };
      const issuances = await prisma.keyIssuance.findMany({
        where: {
          tenantId,
          ...(q.propertyId ? { propertyId: q.propertyId } : {}),
          ...(q.status ? { status: q.status } : {}),
        },
        include: { room: { select: { number: true } } },
        orderBy: { issuedAt: 'desc' },
        take: 300,
      });
      res.json({ data: issuances });
    } catch (err) {
      next(err);
    }
  }
);

keysRouter.post(
  '/issue',
  requirePermission('task', 'create'),
  validateBody(issueSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      const body = req.validatedBody as {
        roomId: string;
        reservationId?: string;
        guestName?: string;
        notes?: string;
      };
      const room = await prisma.room.findFirst({
        where: { id: body.roomId, tenantId: auth.tenantId },
        select: { id: true, number: true, propertyId: true },
      });
      if (!room) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Room not found' } });
        return;
      }
      const active = await prisma.keyIssuance.findFirst({
        where: { roomId: room.id, status: 'active' },
      });
      if (active) {
        res.status(409).json({
          error: { code: 'CONFLICT', message: `Room ${room.number} already has an active key` },
        });
        return;
      }
      const issuer = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { firstName: true, lastName: true, email: true },
      });
      const issuance = await prisma.keyIssuance.create({
        data: {
          tenantId: auth.tenantId,
          propertyId: room.propertyId,
          roomId: room.id,
          reservationId: body.reservationId ?? null,
          guestName: body.guestName ?? null,
          issuedBy: auth.userId,
          issuerName:
            [issuer?.firstName, issuer?.lastName].filter(Boolean).join(' ') ||
            issuer?.email ||
            'Staff',
          notes: body.notes ?? null,
        },
      });
      res.status(201).json({ data: issuance });
    } catch (err) {
      next(err);
    }
  }
);

const closeSchema = z.object({ notes: z.string().max(500).optional() });

keysRouter.post(
  '/:id/return',
  requirePermission('task', 'update'),
  validateBody(closeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as AuthenticatedRequest).auth.tenantId;
      const { notes } = req.validatedBody as { notes?: string };
      const updated = await prisma.keyIssuance.updateMany({
        where: { id: req.params.id, tenantId, status: 'active' },
        data: { status: 'returned', returnedAt: new Date(), ...(notes ? { notes } : {}) },
      });
      if (updated.count === 0) {
        res.status(409).json({ error: { code: 'CONFLICT', message: 'No active issuance' } });
        return;
      }
      res.json({ data: { returned: true } });
    } catch (err) {
      next(err);
    }
  }
);

keysRouter.post(
  '/:id/lost',
  requirePermission('task', 'update'),
  validateBody(closeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as AuthenticatedRequest).auth.tenantId;
      const { notes } = req.validatedBody as { notes?: string };
      const updated = await prisma.keyIssuance.updateMany({
        where: { id: req.params.id, tenantId, status: 'active' },
        data: { status: 'lost', returnedAt: new Date(), ...(notes ? { notes } : {}) },
      });
      if (updated.count === 0) {
        res.status(409).json({ error: { code: 'CONFLICT', message: 'No active issuance' } });
        return;
      }
      res.json({ data: { lost: true } });
    } catch (err) {
      next(err);
    }
  }
);
