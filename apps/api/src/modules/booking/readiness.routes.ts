/* apps/api/src/modules/booking/readiness.routes.ts — P52 (Phase 9.6)
 * Booking-engine readiness: the self-checks behind the staff banner.
 * A property is "bookable" only when the data says so: sellable spaces,
 * active priced rate plans mapped to a category, and a payment path.
 * Staff-gated (settings:read), tenant-scoped, read-only. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';
import { AppError } from '../../common/errors.js';

export const bookingReadinessRouter = Router();

bookingReadinessRouter.get(
  '/',
  authMiddleware,
  tenantScope,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = String((req.query as Record<string, string>).propertyId ?? '');
      if (!propertyId) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } });
      }
      const property = await prisma.property.findFirst({
        where: { id: propertyId, tenantId: req.tenantId },
      });
      if (!property) throw new AppError(404, 'Property not found', 'NOT_FOUND');

      const [roomTypes, rooms, plans, paymentCount] = await Promise.all([
        prisma.roomType.count({ where: { tenantId: req.tenantId, propertyId } }),
        prisma.room.count({ where: { tenantId: req.tenantId, propertyId } }),
        prisma.ratePlan.findMany({
          where: { tenantId: req.tenantId, propertyId, status: 'active', baseRate: { gt: 0 } },
          select: { roomTypeId: true },
        }),
        prisma.payment.count({ where: { tenantId: req.tenantId } }),
      ]);

      const railConfigured = Boolean(
        process.env.PAYSTACK_SECRET_KEY ?? process.env.PAYSTACK_SECRET
      );
      const mapped = plans.filter((p) => Boolean(p.roomTypeId)).length;

      const checks = [
        {
          key: 'sellable',
          label: 'Sellable spaces',
          done: roomTypes > 0 && rooms > 0,
          hint: roomTypes > 0 && rooms > 0 ? null : 'Add a room type with at least one room.',
        },
        {
          key: 'priced',
          label: 'Active rates',
          done: plans.length > 0,
          hint: plans.length > 0 ? null : 'Publish at least one active rate plan with a price.',
        },
        {
          key: 'mapped',
          label: 'Category/rate mappings',
          done: mapped > 0,
          hint:
            mapped > 0 ? null : 'Link a rate plan to a room category so the widget can price it.',
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
              : 'Rail configured — run one test payment.'
            : 'Platform payment rail keys not configured — contact VIMAD.',
        },
      ];

      const doneCount = checks.filter((c) => c.done).length;
      res.json({
        data: {
          property: { id: property.id, name: property.name, code: property.code },
          checks,
          doneCount,
          total: checks.length,
          percent: Math.round((doneCount / checks.length) * 100),
          ready: doneCount === checks.length,
          widgetUrl: `/book/${property.code}`,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);
