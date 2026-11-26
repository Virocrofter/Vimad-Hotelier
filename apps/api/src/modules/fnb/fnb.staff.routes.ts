/* apps/api/src/modules/fnb/fnb.staff.routes.ts — F3 staff queue. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { transition, refund, listOrders } from './fnb.service.js';

export const fnbStaffRouter = Router();

fnbStaffRouter.use(authMiddleware, tenantScope);

fnbStaffRouter.get('/orders', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const rows = await listOrders(req.tenantId, q);
    res.json({
      data: rows.map((o) => ({
        ...o,
        amount: Number(o.amount),
        items: o.items,
      })),
    });
  } catch (err) {
    next(err);
  }
});

fnbStaffRouter.post(
  '/orders/:id/status',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({ status: z.enum(['preparing', 'served', 'cancelled']) })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
        return;
      }
      const data = await transition(req.tenantId, String(req.params.id), parsed.data.status);
      res.json({ data: { ...data, amount: Number(data.amount) } });
    } catch (err) {
      next(err);
    }
  }
);

fnbStaffRouter.post(
  '/orders/:id/refund',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ reason: z.string().max(300).optional() }).safeParse(req.body ?? {});
      const data = await refund(
        req.tenantId,
        String(req.params.id),
        parsed.success ? parsed.data.reason : undefined
      );
      res.json({
        data: {
          order: { ...data.order, amount: Number(data.order.amount) },
          refundId: data.refundId,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);
