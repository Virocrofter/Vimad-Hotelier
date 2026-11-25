/* apps/api/src/modules/payment-proofs/payment-proofs.routes.ts — P44 EFT POP. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { create, list, verify, reject } from './payment-proofs.service.js';

export const paymentProofsRouter = Router();

paymentProofsRouter.use(authMiddleware, tenantScope);

paymentProofsRouter.post(
  '/',
  requirePermission('folio', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          reservationId: z.string().min(1),
          amount: z.number().positive(),
          reference: z.string().max(120).optional(),
          note: z.string().max(500).optional(),
          fileId: z.string().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid body',
          },
        });
      const data = await create(
        req.tenantId,
        String((req as any).auth?.user?.id ?? ''),
        parsed.data
      );
      return res.status(201).json({ data });
    } catch (err) {
      return next(err);
    }
  }
);

paymentProofsRouter.get('/', requirePermission('folio', 'read'), async (req, res, next) => {
  try {
    return res.json({ data: await list(req.tenantId, req.query as Record<string, string>) });
  } catch (err) {
    return next(err);
  }
});

paymentProofsRouter.post(
  '/:id/verify',
  requirePermission('folio', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ folioId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'folioId is required' } });
      const data = await verify(
        req.tenantId,
        String((req as any).auth?.user?.id ?? ''),
        String(req.params.id),
        parsed.data.folioId
      );
      return res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);

paymentProofsRouter.post(
  '/:id/reject',
  requirePermission('folio', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ reason: z.string().min(1).max(300) }).safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'reason is required' } });
      const data = await reject(
        req.tenantId,
        String((req as any).auth?.user?.id ?? ''),
        String(req.params.id),
        parsed.data.reason
      );
      return res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);
