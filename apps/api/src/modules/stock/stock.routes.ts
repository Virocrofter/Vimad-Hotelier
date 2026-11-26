/* apps/api/src/modules/stock/stock.routes.ts — F6 stock + recipes API,
 * with the F9 item-performance feed. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import {
  createItem,
  adjust,
  listItems,
  movements,
  createRecipe,
  listRecipes,
  itemPerformance,
  transfer,
  listTransfers,
} from './stock.service.js';

export const stockRouter = Router();

stockRouter.use(authMiddleware, tenantScope);

stockRouter.get('/items', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    res.json({ data: await listItems(req.tenantId, q.propertyId) });
  } catch (err) {
    next(err);
  }
});

stockRouter.post(
  '/items',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          propertyId: z.string().min(1),
          name: z.string().min(1).max(120),
          unit: z.string().max(10).optional(),
          parLevel: z.number().min(0).optional(),
          costPerUnit: z.number().min(0).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId + name required' } });
        return;
      }
      const data = await createItem(req.tenantId, parsed.data);
      res.status(201).json({
        data: {
          ...data,
          parLevel: data.parLevel != null ? Number(data.parLevel) : null,
          costPerUnit: data.costPerUnit != null ? Number(data.costPerUnit) : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

stockRouter.post(
  '/items/:id/adjust',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          kind: z.enum(['purchase', 'adjustment', 'waste']),
          quantityDelta: z.number(),
          unitCost: z.number().min(0).optional(),
          note: z.string().max(300).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'kind + quantityDelta required' } });
        return;
      }
      const data = await adjust(req.tenantId, String(req.params.id), {
        ...parsed.data,
        actorId: (req as any).auth.user.id,
      });
      res.status(201).json({
        data: {
          ...data,
          quantityDelta: Number(data.quantityDelta),
          unitCost: data.unitCost != null ? Number(data.unitCost) : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

stockRouter.get(
  '/items/:id/movements',
  requirePermission('ticket', 'read'),
  async (req, res, next) => {
    try {
      res.json({ data: await movements(req.tenantId, String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  }
);

stockRouter.get('/recipes', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    res.json({ data: await listRecipes(req.tenantId, q.propertyId) });
  } catch (err) {
    next(err);
  }
});

stockRouter.post(
  '/recipes',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          propertyId: z.string().min(1),
          name: z.string().min(1).max(120),
          productId: z.string().optional(),
          ingredients: z
            .array(z.object({ stockItemId: z.string().min(1), quantity: z.number().positive() }))
            .min(1),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'name + ingredients[] required' } });
        return;
      }
      const data = await createRecipe(req.tenantId, parsed.data);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

stockRouter.post(
  '/transfer',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          fromItemId: z.string().min(1),
          toItemId: z.string().min(1),
          quantity: z.number().positive(),
          note: z.string().max(300).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'fromItemId + toItemId + quantity required',
          },
        });
        return;
      }
      const data = await transfer(req.tenantId, {
        ...parsed.data,
        actorId: (req as any).auth.user.id,
      });
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

stockRouter.get('/transfers', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    res.json({ data: await listTransfers(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

stockRouter.get('/performance', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    res.json({ data: await itemPerformance(req.tenantId, q.propertyId) });
  } catch (err) {
    next(err);
  }
});
