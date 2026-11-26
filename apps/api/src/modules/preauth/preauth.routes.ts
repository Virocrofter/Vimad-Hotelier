/* apps/api/src/modules/preauth/preauth.routes.ts — preauth hold API. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { createHold, capture, voidHold, listHolds } from './preauth.service.js';

export const preauthRouter = Router();

preauthRouter.use(authMiddleware, tenantScope);

preauthRouter.get('/', requirePermission('folio', 'read'), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    res.json({ data: await listHolds(req.tenantId, q.reservationId) });
  } catch (err) {
    next(err);
  }
});

preauthRouter.post(
  '/',
  requirePermission('folio', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          propertyId: z.string().min(1),
          reservationId: z.string().min(1),
          email: z.string().email(),
          amountMinor: z.number().int().positive(),
          currency: z.string().max(3).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'propertyId + reservationId + email + amountMinor required',
          },
        });
        return;
      }
      const data = await createHold(req.tenantId, parsed.data);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

preauthRouter.post(
  '/:id/capture',
  requirePermission('folio', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await capture(req.tenantId, String(req.params.id));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

preauthRouter.post(
  '/:id/void',
  requirePermission('folio', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await voidHold(req.tenantId, String(req.params.id));
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);
