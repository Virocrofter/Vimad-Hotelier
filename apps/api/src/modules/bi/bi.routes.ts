/* Phase 6.1 — BI hub routes. */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { biFamilies } from './bi.service.js';

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
