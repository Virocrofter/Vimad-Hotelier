/* apps/api/src/modules/shift-pack/shift-pack.routes.ts — P45 load-shedding
 * shift pack: one call aggregates today's arrivals, departures, in-house
 * roll call and room states, stamped with when it was pulled (Eskom mode —
 * the printed sheet IS the fallback). Read-only over existing tables. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { AppError } from '../../common/errors.js';

export const shiftPackRouter = Router();

const dateKey = (d: Date) => d.toLocaleDateString('en-CA');

shiftPackRouter.get(
  '/today',
  authMiddleware,
  tenantScope,
  requirePermission('reservation', 'read'),
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

      const today = dateKey(new Date());
      const yesterday = dateKey(new Date(Date.now() - 86400_000));
      const tomorrow = dateKey(new Date(Date.now() + 86400_000));

      const windowWhere = {
        tenantId: req.tenantId,
        propertyId,
        OR: [
          { arrivalDate: { gte: new Date(yesterday), lte: new Date(tomorrow) } },
          { departureDate: { gte: new Date(yesterday), lte: new Date(tomorrow) } },
          { status: 'checked_in' },
        ],
      };
      const [reservations, rooms] = await Promise.all([
        prisma.reservation.findMany({
          where: windowWhere,
          include: { guest: { select: { firstName: true, lastName: true } } },
          take: 500,
        }),
        prisma.room.findMany({
          where: { tenantId: req.tenantId, propertyId },
          orderBy: { number: 'asc' },
          take: 500,
        }),
      ]);

      const rsv = (r: (typeof reservations)[number]) => ({
        confirmationNumber: r.confirmationNumber,
        guest: `${r.guest.firstName} ${r.guest.lastName}`,
        status: r.status,
        nights: r.nights,
        balance: Number(r.balance),
      });

      return res.json({
        data: {
          generatedAt: new Date().toISOString(),
          property: { id: property.id, name: property.name },
          businessDate: today,
          arrivals: reservations.filter((r) => dateKey(r.arrivalDate) === today).map(rsv),
          departures: reservations.filter((r) => dateKey(r.departureDate) === today).map(rsv),
          inHouse: reservations.filter((r) => r.status === 'checked_in').map(rsv),
          rooms: rooms.map((r) => ({
            number: r.number,
            floor: r.floor,
            housekeepingStatus: r.housekeepingStatus,
            serviceStatus: r.serviceStatus,
            occupied: reservations.some((x) => x.status === 'checked_in'),
          })),
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);
