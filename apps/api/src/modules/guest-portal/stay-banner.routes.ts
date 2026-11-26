/* apps/api/src/modules/guest-portal/stay-banner.routes.ts — P49
 * GET /v1/guest-portal/banner/:token — one call for the portal home banner. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getStayBanner } from './stay-banner.service.js';

export const stayBannerRouter = Router();

stayBannerRouter.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getStayBanner(String(req.params.token));
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
