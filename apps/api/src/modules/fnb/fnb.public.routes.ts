/* apps/api/src/modules/fnb/fnb.public.routes.ts — F3 public surface.
 * Mounted unauthenticated with the public limiter (like the booking engine). */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getMenu, createOrder, beginPayment, verifyOrderPayment } from './fnb.service.js';

export const fnbPublicRouter = Router();

fnbPublicRouter.get('/menu/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await getMenu(String(req.params.code)) });
  } catch (err) {
    next(err);
  }
});

const orderSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(20) }))
    .min(1),
  email: z.string().email().optional(),
  tableLabel: z.string().max(40).optional(),
});

fnbPublicRouter.post('/orders/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
        },
      });
      return;
    }
    res.status(201).json({ data: await createOrder(String(req.params.code), parsed.data) });
  } catch (err) {
    next(err);
  }
});

fnbPublicRouter.post('/orders/:id/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email required' } });
      return;
    }
    res.json({ data: await beginPayment(String(req.params.id), parsed.data.email) });
  } catch (err) {
    next(err);
  }
});

fnbPublicRouter.get(
  '/orders/verify/:reference',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await verifyOrderPayment(String(req.params.reference)) });
    } catch (err) {
      next(err);
    }
  }
);
