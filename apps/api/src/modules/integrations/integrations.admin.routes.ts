/* apps/api/src/modules/integrations/integrations.admin.routes.ts — D2
 * marketplace API. Tenant-scoped, owner/admin only. Peripheral endpoints
 * (logs, webhook-events) return empty lists until their adapters land. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';
import {
  listProviders,
  listConnected,
  stats,
  connect,
  disconnect,
  sync,
  test,
  updateConfig,
  rotateCredentials,
} from './integrations.admin.service.js';

export const integrationsAdminRouter = Router();

const ownerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = String((req as any).auth?.user?.role ?? '');
  if (role !== 'owner' && role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'FORBIDDEN', message: 'Integrations are owner/admin only' } });
  }
  return next();
};

integrationsAdminRouter.use(authMiddleware, tenantScope, ownerOrAdmin);

const idParams = (req: Request) => String(req.params.id);

integrationsAdminRouter.get('/providers', async (req, res, next) => {
  try {
    return res.json({ data: await listProviders(req.tenantId) });
  } catch (err) {
    return next(err);
  }
});

integrationsAdminRouter.get('/connected', async (req, res, next) => {
  try {
    return res.json({ data: await listConnected(req.tenantId) });
  } catch (err) {
    return next(err);
  }
});

integrationsAdminRouter.get('/stats', async (req, res, next) => {
  try {
    return res.json({ data: await stats(req.tenantId) });
  } catch (err) {
    return next(err);
  }
});

integrationsAdminRouter.post('/connect', async (req, res, next) => {
  try {
    const parsed = z
      .object({
        provider: z.string().min(1),
        credentials: z.record(z.string(), z.unknown()).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
    const data = await connect(
      req.tenantId,
      String((req as any).auth?.user?.id ?? ''),
      parsed.data
    );
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

integrationsAdminRouter.post('/disconnect', async (req, res, next) => {
  try {
    const parsed = z.object({ id: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
    return res.json({ data: await disconnect(req.tenantId, parsed.data.id) });
  } catch (err) {
    return next(err);
  }
});

integrationsAdminRouter.post('/sync', async (req, res, next) => {
  try {
    const parsed = z.object({ id: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
    return res.json({ data: await sync(req.tenantId, parsed.data.id) });
  } catch (err) {
    return next(err);
  }
});

integrationsAdminRouter.post('/test', async (req, res, next) => {
  try {
    const parsed = z.object({ id: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
    return res.json({ data: await test(req.tenantId, parsed.data.id) });
  } catch (err) {
    return next(err);
  }
});

integrationsAdminRouter.patch('/config/:id', async (req, res, next) => {
  try {
    const parsed = z.object({ config: z.record(z.string(), z.unknown()) }).safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
    return res.json({ data: await updateConfig(req.tenantId, idParams(req), parsed.data) });
  } catch (err) {
    return next(err);
  }
});

integrationsAdminRouter.post('/:id/rotate', async (req, res, next) => {
  try {
    return res.json({ data: await rotateCredentials(req.tenantId, String(req.params.id)) });
  } catch (err) {
    return next(err);
  }
});

/* Peripheral endpoints — empty until their adapters land (UI renders clean). */
integrationsAdminRouter.get('/logs/:id', async (_req, res) => res.json({ data: [] }));
integrationsAdminRouter.get('/webhook-events', async (_req, res) => res.json({ data: [] }));
integrationsAdminRouter.get('/webhook-config/:provider', async (_req, res) =>
  res.json({ data: null })
);
integrationsAdminRouter.post('/webhook-events/:id/retry', async (_req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No webhook events yet' } })
);
integrationsAdminRouter.post('/webhook-events/:id/configure', async (_req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No webhook events yet' } })
);
