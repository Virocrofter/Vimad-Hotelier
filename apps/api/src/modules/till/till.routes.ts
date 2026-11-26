/* apps/api/src/modules/till/till.routes.ts — F5 staff till API. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import {
  openCheck,
  addItem,
  moveItem,
  compItem,
  reverseComp,
  closeCheck,
  listChecks,
  openSession,
  closeSession,
  listSessions,
} from './till.service.js';

export const tillRouter = Router();

tillRouter.use(authMiddleware, tenantScope);

tillRouter.get('/checks', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const data = await listChecks(req.tenantId, q);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

tillRouter.post(
  '/checks',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({ propertyId: z.string().min(1), label: z.string().min(1).max(40) })
        .safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId + label required' } });
        return;
      }
      const data = await openCheck(req.tenantId, {
        ...parsed.data,
        userId: (req as any).auth.user.id,
      });
      res.status(201).json({
        data: {
          ...data,
          totalCharges: Number(data.totalCharges),
          totalComps: Number(data.totalComps),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

tillRouter.post(
  '/checks/:id/items',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          productId: z.string().optional(),
          name: z.string().max(80).optional(),
          unitPrice: z.number().min(0).optional(),
          quantity: z.number().int().min(1).max(50).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item' } });
        return;
      }
      const data = await addItem(req.tenantId, String(req.params.id), parsed.data);
      res.status(201).json({ data: { ...data, unitPrice: Number(data.unitPrice) } });
    } catch (err) {
      next(err);
    }
  }
);

tillRouter.post(
  '/items/:itemId/move',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ toCheckId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'toCheckId required' } });
        return;
      }
      const data = await moveItem(req.tenantId, String(req.params.itemId), parsed.data.toCheckId);
      res.json({ data: data && { ...data, unitPrice: Number(data.unitPrice) } });
    } catch (err) {
      next(err);
    }
  }
);

tillRouter.post(
  '/items/:itemId/comp',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ reason: z.string().min(1).max(200) }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'reason required' } });
        return;
      }
      const data = await compItem(req.tenantId, String(req.params.itemId), parsed.data.reason);
      res.json({ data: { ...data, unitPrice: Number(data.unitPrice) } });
    } catch (err) {
      next(err);
    }
  }
);

tillRouter.post(
  '/items/:itemId/reverse-comp',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await reverseComp(req.tenantId, String(req.params.itemId));
      res.json({ data: { ...data, unitPrice: Number(data.unitPrice) } });
    } catch (err) {
      next(err);
    }
  }
);

tillRouter.post(
  '/checks/:id/close',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          payments: z
            .array(
              z.object({
                method: z.enum(['cash', 'card', 'voucher', 'room']),
                amountMinor: z.number().int().positive(),
                reservationId: z.string().optional(),
              })
            )
            .min(1),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'payments[] required' } });
        return;
      }
      const data = await closeCheck(req.tenantId, String(req.params.id), parsed.data.payments);
      res.json({
        data: {
          check: {
            ...data.check,
            totalCharges: Number(data.check.totalCharges),
            totalComps: Number(data.check.totalComps),
          },
          folioItemIds: data.folioItemIds,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

tillRouter.post(
  '/sessions/open',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({ propertyId: z.string().min(1), openingFloatMinor: z.number().int().min(0) })
        .safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId + float required' } });
        return;
      }
      const data = await openSession(req.tenantId, {
        ...parsed.data,
        userId: (req as any).auth.user.id,
      });
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

tillRouter.post(
  '/sessions/:id/close',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ countedCashMinor: z.number().int().min(0) }).safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'countedCashMinor required' } });
        return;
      }
      const data = await closeSession(
        req.tenantId,
        String(req.params.id),
        parsed.data.countedCashMinor
      );
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

tillRouter.get('/sessions', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const data = await listSessions(req.tenantId, q.propertyId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
