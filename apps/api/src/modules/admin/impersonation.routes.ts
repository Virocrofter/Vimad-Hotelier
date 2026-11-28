/* apps/api/src/modules/admin/impersonation.routes.ts
 * Impersonation session endpoints (Phase 3a, 2026-11-28). Guardrails per
 * blueprint: mandatory ticket#, 60-minute TTL, READ_ONLY default, IP
 * recorded, every start logged WARN. Start is FOUNDER-only until Phase 3b
 * opens READ_ONLY to SUPPORT_AGENT. The hotel-workspace bridge (actually
 * viewing/acting as the tenant) lands with the impersonation UI. */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireInternalRole } from './admin.middleware.js';
import {
  startImpersonation,
  endImpersonation,
  activeImpersonations,
  enterImpersonation,
} from './internal-admin.service.js';

export const impersonationRouter = Router();

const StartSchema = z.object({
  tenantId: z.string().min(1),
  mode: z.enum(['READ_ONLY', 'FULL_WRITE']).default('READ_ONLY'),
  ticket: z.string().min(3, 'support ticket number is required'),
});

impersonationRouter.post(
  '/start',
  requireInternalRole('FOUNDER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = StartSchema.parse(req.body ?? {});
      const admin = (req as any).internalAdmin;
      const session = await startImpersonation({
        adminEmail: admin.email,
        tenantId: body.tenantId,
        mode: body.mode,
        ticket: body.ticket,
        ip: req.ip ?? null,
      });
      return res.status(201).json(session);
    } catch (err) {
      return next(err);
    }
  }
);

impersonationRouter.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = (req as any).internalAdmin;
    const sessions = await activeImpersonations(admin.role === 'FOUNDER' ? undefined : admin.email);
    return res.json({ data: sessions });
  } catch (err) {
    return next(err);
  }
});

impersonationRouter.post('/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = (req as any).internalAdmin;
    const session = await endImpersonation(req.params.id, admin.email, admin.role === 'FOUNDER');
    if (!session) return res.status(404).json({ error: 'session not found or already ended' });
    return res.json(session);
  } catch (err) {
    return next(err);
  }
});

/* Token exchange: swap an active session for a tenant-scoped impersonation
 * JWT (TTL = session's remaining minutes). FOUNDER-only. */
impersonationRouter.post(
  '/:id/enter',
  requireInternalRole('FOUNDER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const admin = (req as any).internalAdmin;
      return res.json(await enterImpersonation(req.params.id, admin.email));
    } catch (err) {
      return next(err);
    }
  }
);
