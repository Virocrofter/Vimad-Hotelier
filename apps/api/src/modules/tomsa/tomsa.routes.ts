/* apps/api/src/modules/tomsa/tomsa.routes.ts — P43 TOMSA remittance. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { remittance } from './tomsa.service.js';

export const tomsaRouter = Router();

tomsaRouter.get(
  '/remittance',
  authMiddleware,
  tenantScope,
  requirePermission('report', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as { month?: string; propertyId?: string };
      if (!q.propertyId) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } });
      }
      return res.json({ data: await remittance(req.tenantId, q) });
    } catch (err) {
      return next(err);
    }
  }
);
