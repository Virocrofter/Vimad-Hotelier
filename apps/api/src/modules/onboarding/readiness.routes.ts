/* apps/api/src/modules/onboarding/readiness.routes.ts — P48 onboarding
 * packaging: the data-verified go-live gate the self-reported wizard can't
 * give. Five dimensions checked against live tenant data:
 *   property basics → spaces → rates → payments → channel mapping.
 * A tenant is "ready" only when the data says so. Read-only. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';

export const readinessRouter = Router();

readinessRouter.use(authMiddleware, tenantScope);

readinessRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;

    const [properties, roomTypes, rooms, ratePlans, channels, paymentCount] = await Promise.all([
      prisma.property.count({ where: { tenantId } }),
      prisma.roomType.count({ where: { tenantId } }),
      prisma.room.count({ where: { tenantId } }),
      prisma.ratePlan.count({ where: { tenantId } }),
      prisma.channelConnection.count({ where: { tenantId } }),
      prisma.payment.count({ where: { tenantId } }),
    ]);

    const railConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY ?? process.env.PAYSTACK_SECRET);

    const steps = [
      {
        key: 'property_basics',
        label: 'Property basics',
        done: properties > 0,
        hint: properties > 0 ? null : 'Create your property (name, currency, timezone).',
      },
      {
        key: 'spaces',
        label: 'Spaces',
        done: roomTypes > 0 && rooms > 0,
        hint: roomTypes > 0 && rooms > 0 ? null : 'Add at least one room type and one room.',
      },
      {
        key: 'rates',
        label: 'Rates',
        done: ratePlans > 0,
        hint: ratePlans > 0 ? null : 'Add at least one rate plan.',
      },
      {
        key: 'payments',
        label: 'Payments',
        done: railConfigured || paymentCount > 0,
        configured: railConfigured,
        tested: paymentCount > 0,
        hint: railConfigured
          ? paymentCount > 0
            ? null
            : 'Rail configured — run one test payment to prove it.'
          : 'Platform payment rail keys not configured — contact VIMAD.',
      },
      {
        key: 'channel_mapping',
        label: 'Channel mapping',
        done: channels > 0,
        hint:
          channels > 0
            ? null
            : 'Connect a channel (Channex/Booking.com) when credentials arrive — or skip for direct-only.',
      },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    res.json({
      data: {
        steps,
        doneCount,
        total: steps.length,
        percent: Math.round((doneCount / steps.length) * 100),
        ready: doneCount === steps.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
});
