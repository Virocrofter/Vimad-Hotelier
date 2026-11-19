/* apps/api/src/modules/logbook/logbook.routes.ts — [LOGBOOK] shift handover
 * notes. Permissions ride the task pair (every role that can read/create
 * tasks can use the logbook) until a dedicated logbook permission is seeded. */
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

export const logbookRouter = Router();
logbookRouter.use(authMiddleware, tenantScope);

const listQuerySchema = z.object({ propertyId: z.string().optional() });
const createSchema = z.object({
  propertyId: z.string().min(1),
  category: z.string().min(1).max(40).default('general'),
  message: z.string().min(2).max(2000),
  shift: z.string().max(20).optional(),
});

logbookRouter.get(
  '/',
  requirePermission('task', 'read'),
  validateQuery(listQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as AuthenticatedRequest).auth.tenantId;
      const { propertyId } = req.validatedQuery as { propertyId?: string };
      const entries = await prisma.logbookEntry.findMany({
        where: { tenantId, ...(propertyId ? { propertyId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      res.json({ data: entries });
    } catch (err) {
      next(err);
    }
  }
);

logbookRouter.post(
  '/',
  requirePermission('task', 'create'),
  validateBody(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      const body = req.validatedBody as {
        propertyId: string;
        category: string;
        message: string;
        shift?: string;
      };
      const author = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { firstName: true, lastName: true, email: true },
      });
      const entry = await prisma.logbookEntry.create({
        data: {
          tenantId: auth.tenantId,
          propertyId: body.propertyId,
          authorId: auth.userId,
          authorName:
            [author?.firstName, author?.lastName].filter(Boolean).join(' ') ||
            author?.email ||
            'Staff',
          category: body.category,
          message: body.message,
          shift: body.shift ?? null,
        },
      });
      res.status(201).json({ data: entry });
    } catch (err) {
      next(err);
    }
  }
);
