/* apps/api/src/modules/agents/agents.routes.ts — D8 travel-agent portal.
 * Role 'travel_agent' + bound agent account; every route is scoped to the
 * caller's account (never a passed id). */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';
import { overview, bookings, invoices, createBooking } from './agents.service.js';

export const agentsRouter = Router();

const agentOnly = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as any;
  if (authReq.auth?.user?.role !== 'travel_agent' || !authReq.auth?.user?.agentAccountId) {
    return res
      .status(403)
      .json({ error: { code: 'FORBIDDEN', message: 'Travel-agent portal is agent-only' } });
  }
  return next();
};

agentsRouter.use(authMiddleware, tenantScope, agentOnly);

const accountOf = (req: Request) => String((req as any).auth.user.agentAccountId);

agentsRouter.get('/portal/overview', async (req, res, next) => {
  try {
    return res.json({ data: await overview(req.tenantId, accountOf(req)) });
  } catch (err) {
    return next(err);
  }
});

agentsRouter.get('/portal/bookings', async (req, res, next) => {
  try {
    return res.json({ data: await bookings(req.tenantId, accountOf(req)) });
  } catch (err) {
    return next(err);
  }
});

agentsRouter.get('/portal/invoices', async (req, res, next) => {
  try {
    return res.json({ data: await invoices(req.tenantId, accountOf(req)) });
  } catch (err) {
    return next(err);
  }
});

agentsRouter.post('/portal/bookings', async (req, res, next) => {
  try {
    const parsed = z
      .object({
        guestFirstName: z.string().min(1),
        guestLastName: z.string().min(1),
        guestEmail: z.string().email().optional(),
        roomTypeId: z.string().min(1),
        arrivalDate: z.string().min(8),
        departureDate: z.string().min(8),
        grossAmount: z.number().positive(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
    const data = await createBooking(req.tenantId, accountOf(req), parsed.data);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});
