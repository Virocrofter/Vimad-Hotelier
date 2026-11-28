/* apps/api/src/modules/admin/webhook-center.routes.ts
 * Founder-side fleet webhook endpoints (mounted at /admin/webhooks after
 * authMiddleware + requireAdminRole in admin.routes.ts). */
import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listFleetDeliveries,
  getFleetDelivery,
  replayFleetDelivery,
  getWebhookStats,
} from './webhook-center.service.js';

export const webhookCenterRouter = Router();

webhookCenterRouter.get('/deliveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(await listFleetDeliveries(req.query as Record<string, string>));
  } catch (err) {
    return next(err);
  }
});

webhookCenterRouter.get(
  '/deliveries/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return res.json(await getFleetDelivery(req.params.id));
    } catch (err) {
      return next(err);
    }
  }
);

webhookCenterRouter.post(
  '/deliveries/:id/replay',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return res.json(await replayFleetDelivery(req.params.id));
    } catch (err) {
      return next(err);
    }
  }
);

webhookCenterRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(await getWebhookStats());
  } catch (err) {
    return next(err);
  }
});
