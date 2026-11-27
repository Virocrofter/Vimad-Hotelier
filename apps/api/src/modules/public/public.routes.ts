/* apps/api/src/modules/public/public.routes.ts
 * A4 — public booking engine routes. Unauthenticated (guests have no login),
 * validated with zod, rate-limited at the mount point (publicLimiter in index.ts).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  availabilityQuerySchema,
  publicBookingSchema,
  publicCancellationSchema,
  getPublicProperty,
  getAvailability,
  createPublicBooking,
  cancelPublicBooking,
  unsubscribeQuerySchema,
  unsubscribeByToken,
} from './public.service.js';
import { validateBody, validateQuery } from '../../common/validate.js';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';

export const publicRouter = Router();

/* GET /properties/:code — header info for the booking page */
publicRouter.get('/properties/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await getPublicProperty(req.params.code) });
  } catch (err) {
    next(err);
  }
});

/* GET /properties/:code/availability?checkIn&checkOut&adults&children */
publicRouter.get(
  '/properties/:code/availability',
  validateQuery(availabilityQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getAvailability(req.params.code, req.validatedQuery as any);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

/* POST /properties/:code/bookings — the booking itself */
publicRouter.post(
  '/properties/:code/bookings',
  validateBody(publicBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createPublicBooking(req.params.code, req.validatedBody as any);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

/* POST /cancellations — public cancel by confirmation number + email */
publicRouter.post(
  '/cancellations',
  validateBody(publicCancellationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await cancelPublicBooking(req.validatedBody as any);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

/* 11.3 — cross-sell: sister properties of the chain with availability
 * for the guest's dates (sold-out → book at our sister property). */
publicRouter.get(
  '/chain/:code/sisters',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string>;
      const current = await prisma.property.findFirst({ where: { code: String(req.params.code) } });
      if (!current) throw new AppError(404, 'Property not found', 'NOT_FOUND');
      if (!current.chainId) {
        res.json({ data: { sisters: [] } });
        return;
      }

      const siblings = await prisma.property.findMany({
        where: { tenantId: current.tenantId, chainId: current.chainId, id: { not: current.id } },
        take: 10,
      });
      const { getAvailability } = await import('./public.service.js');
      const out = [];
      for (const sib of siblings) {
        const avail = await getAvailability(sib.code, {
          checkIn: q.checkIn ?? '',
          checkOut: q.checkOut ?? '',
          adults: Number(q.adults ?? 2),
          children: Number(q.children ?? 0),
        });
        const cheapest = avail.roomTypes.reduce(
          (m, r) => Math.min(m, r.total ?? Infinity),
          Infinity
        );
        if (!Number.isFinite(cheapest)) continue;
        out.push({
          code: sib.code,
          name: sib.name,
          imageKey: sib.imageKey ?? null,
          cheapestTotal: cheapest,
          roomTypes: avail.roomTypes.length,
        });
      }
      out.sort((a, b) => a.cheapestTotal - b.cheapestTotal);
      res.json({ data: { sisters: out } });
    } catch (err) {
      next(err);
    }
  }
);

/* GET /image/:key — signed-URL redirect for catalog/room photos (P65) */
publicRouter.get('/image/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getSignedDownloadUrl } = await import('../../common/storage.js');
    res.redirect(await getSignedDownloadUrl(String(req.params.key), { ttlSeconds: 3600 }));
  } catch (err) {
    next(err);
  }
});

/* GET /theme/:code — white-label theme for the /book/:code widget (DS-12).
 * Public by design (the widget is guest-facing); 404 when no active theme. */
publicRouter.get('/theme/:code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../common/prisma.js');
    const property = await prisma.property.findFirst({ where: { code: String(req.params.code) } });
    if (!property)
      throw new (await import('../../common/errors.js')).AppError(
        404,
        'Property not found',
        'NOT_FOUND'
      );
    const theme = await prisma.tenantTheme.findFirst({
      where: { tenantId: property.tenantId, isActive: true },
    });
    if (!theme) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No active theme' } });
      return;
    }
    res.json({
      data: {
        accent: theme.accent,
        ring: theme.ring ?? theme.accent,
        radiusPx: theme.radiusPx ?? null,
        logoKey: theme.logoKey ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* GET /marketing/unsubscribe?token= — one-click unsubscribe, no login (E5) */
publicRouter.get(
  '/marketing/unsubscribe',
  validateQuery(unsubscribeQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await unsubscribeByToken((req.validatedQuery as { token: string }).token);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);
