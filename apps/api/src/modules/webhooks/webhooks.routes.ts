/* apps/api/src/modules/webhooks/webhooks.routes.ts — D1+ developer webhooks.
 * Owner/admin only (developer-portal semantics). */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createEndpoint,
  listEndpoints,
  updateEndpoint,
  deleteEndpoint,
  rotateSecret,
  listDeliveries,
  replayDelivery,
  sendTestEvent,
} from './webhooks.service.js';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';

export const webhooksRouter = Router();

const ownerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = String((req as any).user?.role ?? (req as any).auth?.role ?? '');
  if (role !== 'owner' && role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'FORBIDDEN', message: 'Webhooks are owner/admin only' } });
  }
  return next();
};

webhooksRouter.use(authMiddleware, tenantScope);
webhooksRouter.use(ownerOrAdmin);

webhooksRouter.post('/', async (req, res, next) => {
  try {
    const parsed = z
      .object({
        url: z.string().min(8).max(500),
        events: z.array(z.string().min(1).max(80)).min(1).max(50),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
        },
      });
    const data = await createEndpoint(
      req.tenantId,
      String((req as any).user?.id ?? ''),
      parsed.data
    );
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

webhooksRouter.get('/', async (req, res, next) => {
  try {
    return res.json({ data: await listEndpoints(req.tenantId) });
  } catch (err) {
    return next(err);
  }
});

webhooksRouter.post('/test/:endpointId', async (req, res, next) => {
  try {
    return res
      .status(201)
      .json({ data: await sendTestEvent(req.tenantId, String(req.params.endpointId)) });
  } catch (err) {
    return next(err);
  }
});

webhooksRouter.get('/deliveries', async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    return res.json({ data: await listDeliveries(req.tenantId, q) });
  } catch (err) {
    return next(err);
  }
});

webhooksRouter.post('/deliveries/:id/replay', async (req, res, next) => {
  try {
    return res.json({ data: await replayDelivery(req.tenantId, String(req.params.id)) });
  } catch (err) {
    return next(err);
  }
});

webhooksRouter.patch('/:id', async (req, res, next) => {
  try {
    const parsed = z
      .object({
        url: z.string().min(8).max(500).optional(),
        events: z.array(z.string().min(1).max(80)).max(50).optional(),
        status: z.enum(['active', 'paused']).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
    return res.json({
      data: await updateEndpoint(req.tenantId, String(req.params.id), parsed.data),
    });
  } catch (err) {
    return next(err);
  }
});

webhooksRouter.post('/:id/rotate', async (req, res, next) => {
  try {
    return res.json({ data: await rotateSecret(req.tenantId, String(req.params.id)) });
  } catch (err) {
    return next(err);
  }
});

webhooksRouter.delete('/:id', async (req, res, next) => {
  try {
    return res.json({ data: await deleteEndpoint(req.tenantId, String(req.params.id)) });
  } catch (err) {
    return next(err);
  }
});
