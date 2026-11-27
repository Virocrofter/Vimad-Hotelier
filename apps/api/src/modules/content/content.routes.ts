/* apps/api/src/modules/content/content.routes.ts — staff content management:
 * room types and catalog items with photos + descriptions (the rich
 * booking page + QR menu render from these). Reads property-scoped, writes
 * owner/manager-gated via property:update. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';

export const contentRouter = Router();

contentRouter.use(authMiddleware, tenantScope);

contentRouter.get(
  '/room-types',
  requirePermission('property', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = String((req.query as Record<string, string>).propertyId ?? '');
      const rows = await prisma.roomType.findMany({
        where: { tenantId: req.tenantId, ...(propertyId ? { propertyId } : {}) },
        orderBy: { name: 'asc' },
        take: 200,
      });
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  }
);

contentRouter.patch(
  '/room-types/:id',
  requirePermission('property', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          imageKey: z.string().max(300).nullable().optional(),
          description: z.string().max(2000).nullable().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
        return;
      }
      const data: Record<string, unknown> = {};
      if (parsed.data.imageKey !== undefined) data.imageKey = parsed.data.imageKey;
      if (parsed.data.description !== undefined) data.description = parsed.data.description;
      const upd = await prisma.roomType.updateMany({
        where: { id: String(req.params.id), tenantId: req.tenantId },
        data,
      });
      if (upd.count === 0) throw new AppError(404, 'Room type not found', 'NOT_FOUND');
      res.json({ data: await prisma.roomType.findFirst({ where: { id: String(req.params.id) } }) });
    } catch (err) {
      next(err);
    }
  }
);

contentRouter.get(
  '/upsell-products',
  requirePermission('property', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = String((req.query as Record<string, string>).propertyId ?? '');
      const rows = await prisma.upsellProduct.findMany({
        where: { tenantId: req.tenantId, ...(propertyId ? { propertyId } : {}) },
        orderBy: { name: 'asc' },
        take: 200,
      });
      res.json({
        data: rows.map((r) => ({ ...r, price: Number(r.price) })),
      });
    } catch (err) {
      next(err);
    }
  }
);

contentRouter.patch(
  '/upsell-products/:id',
  requirePermission('property', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          imageKey: z.string().max(300).nullable().optional(),
          description: z.string().max(2000).nullable().optional(),
          name: z.string().min(1).max(120).optional(),
          price: z.number().positive().optional(),
          category: z.string().max(40).optional(),
          status: z.enum(['active', 'inactive']).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
        return;
      }
      const data: Record<string, unknown> = {};
      if (parsed.data.imageKey !== undefined) data.imageKey = parsed.data.imageKey;
      if (parsed.data.description !== undefined) data.description = parsed.data.description;
      if (parsed.data.name !== undefined) data.name = parsed.data.name;
      if (parsed.data.price !== undefined) data.price = new Prisma.Decimal(parsed.data.price);
      if (parsed.data.category !== undefined) data.category = parsed.data.category;
      if (parsed.data.status !== undefined) data.status = parsed.data.status;
      const upd = await prisma.upsellProduct.updateMany({
        where: { id: String(req.params.id), tenantId: req.tenantId },
        data,
      });
      if (upd.count === 0) throw new AppError(404, 'Product not found', 'NOT_FOUND');
      const row = await prisma.upsellProduct.findFirst({ where: { id: String(req.params.id) } });
      res.json({ data: row && { ...row, price: Number(row.price) } });
    } catch (err) {
      next(err);
    }
  }
);
