/* apps/api/src/modules/vouchers/vouchers.routes.ts — D7 gift vouchers.
 * Owner/admin only in v1 (front-desk redeem via folio permissions rides a
 * follow-up). Payment capture happens in the checkout flow; this API records
 * the Paystack reference on sell. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';
import { sell, redeem, refund, list, liability } from './vouchers.service.js';

export const vouchersRouter = Router();

const ownerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = String((req as any).auth?.user?.role ?? '');
  if (role !== 'owner' && role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'FORBIDDEN', message: 'Vouchers are owner/admin only' } });
  }
  return next();
};

vouchersRouter.use(authMiddleware, tenantScope, ownerOrAdmin);

vouchersRouter.post('/sell', async (req, res, next) => {
  try {
    const parsed = z
      .object({
        amount: z.number().positive(),
        purchaserName: z.string().min(1).max(200),
        purchaserEmail: z.string().email(),
        recipientName: z.string().max(200).optional(),
        paymentRef: z.string().max(120).optional(),
        propertyId: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
        },
      });
    const data = await sell(req.tenantId, String((req as any).auth?.user?.id ?? ''), parsed.data);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

vouchersRouter.post('/redeem', async (req, res, next) => {
  try {
    const parsed = z
      .object({ code: z.string().min(4), folioId: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'code and folioId are required' } });
    return res.json({ data: await redeem(req.tenantId, parsed.data.code, parsed.data.folioId) });
  } catch (err) {
    return next(err);
  }
});

vouchersRouter.post('/:id/refund', async (req, res, next) => {
  try {
    const parsed = z.object({ reason: z.string().min(1).max(300) }).safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'reason is required' } });
    return res.json({
      data: await refund(req.tenantId, String(req.params.id), parsed.data.reason),
    });
  } catch (err) {
    return next(err);
  }
});

vouchersRouter.get('/', async (req, res, next) => {
  try {
    return res.json({ data: await list(req.tenantId, req.query as Record<string, string>) });
  } catch (err) {
    return next(err);
  }
});

vouchersRouter.get('/liability', async (req, res, next) => {
  try {
    return res.json({ data: await liability(req.tenantId) });
  } catch (err) {
    return next(err);
  }
});
