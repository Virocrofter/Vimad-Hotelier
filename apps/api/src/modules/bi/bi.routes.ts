/* Phase 6.1 — BI hub routes. */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { biBriefing, biFamilies, biLedgers, bookingCurve } from './bi.service.js';

export const biRouter = Router();
biRouter.use(authMiddleware, tenantScope);

biRouter.get(
  '/families',
  requirePermission('report', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = String((req.query as any).propertyId ?? '');
      if (!propertyId) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } });
      }
      const data = await biFamilies(req.tenantId!, propertyId);
      res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);

biRouter.get(
  '/briefing',
  requirePermission('report', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = String((req.query as any).propertyId ?? '');
      if (!propertyId) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } });
      }
      const data = await biBriefing(req.tenantId!, propertyId);
      res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);

biRouter.get(
  '/booking-curve',
  requirePermission('report', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string>;
      const propertyId = String(q.propertyId ?? '');
      if (!propertyId) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } });
      }
      const data = await bookingCurve(req.tenantId!, propertyId, Number(q.days) || 30);
      res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);

// 6.2 — saved views: per-user filter-state snapshots on the hub.
biRouter.get(
  '/views',
  requirePermission('report', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await prisma.savedView.findMany({
        where: { tenantId: req.tenantId! },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, name: true, propertyId: true, config: true, createdAt: true },
      });
      res.json({ data: rows });
    } catch (err) {
      return next(err);
    }
  }
);

biRouter.post(
  '/views',
  requirePermission('report', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, propertyId, config } = (req.body ?? {}) as any;
      if (!name?.trim()) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
      }
      const row = await prisma.savedView.create({
        data: {
          tenantId: req.tenantId!,
          userId: ((req as any).auth?.userId ?? (req as any).auth?.id ?? null) as string | null,
          propertyId: propertyId ? String(propertyId) : null,
          name: String(name).trim(),
          config: (config ?? {}) as any,
        },
      });
      res.status(201).json({ data: { id: row.id, name: row.name } });
    } catch (err) {
      return next(err);
    }
  }
);

biRouter.delete(
  '/views/:id',
  requirePermission('report', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.savedView.deleteMany({
        where: { id: String((req.params as { id: string }).id), tenantId: req.tenantId! },
      });
      res.json({ data: { deleted: true } });
    } catch (err) {
      return next(err);
    }
  }
);

biRouter.get(
  '/ledgers',
  requirePermission('report', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = String((req.query as any).propertyId ?? '');
      if (!propertyId) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } });
      }
      const data = await biLedgers(req.tenantId!, propertyId);
      res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);
