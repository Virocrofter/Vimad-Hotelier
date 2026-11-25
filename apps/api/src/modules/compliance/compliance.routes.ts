/* apps/api/src/modules/compliance/compliance.routes.ts — P47 security-incident
 * (breach) ledger: report → investigate → resolve, with Information Officer
 * notification tracking. Owner/admin only (compliance surface). */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';

export const complianceRouter = Router();

const ownerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = String((req as any).auth?.user?.role ?? '');
  if (role !== 'owner' && role !== 'admin') {
    return res
      .status(403)
      .json({ error: { code: 'FORBIDDEN', message: 'Compliance is owner/admin only' } });
  }
  return next();
};

complianceRouter.use(authMiddleware, tenantScope, ownerOrAdmin);

const toPublic = (i: Record<string, any>) => ({
  id: i.id,
  type: i.type,
  severity: i.severity,
  title: i.title,
  description: i.description,
  occurredAt: i.occurredAt,
  status: i.status,
  resolution: i.resolution,
  officerNotified: i.officerNotified,
  reportedById: i.reportedById,
  resolvedAt: i.resolvedAt,
  createdAt: i.createdAt,
});

const CreateIncidentSchema = z.object({
  type: z.string().min(1).max(60),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  occurredAt: z.string().optional(),
});

complianceRouter.post('/incidents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateIncidentSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
        },
      });
    const incident = await prisma.securityIncident.create({
      data: {
        tenantId: req.tenantId,
        type: parsed.data.type,
        severity: parsed.data.severity,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
        reportedById: String((req as any).auth?.user?.id ?? ''),
      },
    });
    return res.status(201).json({ data: toPublic(incident) });
  } catch (err) {
    return next(err);
  }
});

complianceRouter.get('/incidents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = String((req.query as Record<string, string>).status ?? '');
    const rows = await prisma.securityIncident.findMany({
      where: { tenantId: req.tenantId, ...(status ? { status } : {}) },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
    return res.json({ data: rows.map(toPublic) });
  } catch (err) {
    return next(err);
  }
});

complianceRouter.post(
  '/incidents/:id/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          status: z.enum(['investigating', 'resolved']),
          resolution: z.string().max(2000).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
      const existing = await prisma.securityIncident.findFirst({
        where: { id: String(req.params.id), tenantId: req.tenantId },
      });
      if (!existing) throw new AppError(404, 'Incident not found', 'NOT_FOUND');
      if (existing.status === 'resolved') {
        throw new AppError(409, 'Incident already resolved', 'ALREADY_RESOLVED');
      }
      const updated = await prisma.securityIncident.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.status,
          resolution: parsed.data.resolution ?? existing.resolution,
          resolvedById:
            parsed.data.status === 'resolved' ? String((req as any).auth?.user?.id ?? '') : null,
          resolvedAt: parsed.data.status === 'resolved' ? new Date() : null,
        },
      });
      return res.json({ data: toPublic(updated) });
    } catch (err) {
      return next(err);
    }
  }
);

complianceRouter.post(
  '/incidents/:id/notify-officer',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.securityIncident.findFirst({
        where: { id: String(req.params.id), tenantId: req.tenantId },
      });
      if (!existing) throw new AppError(404, 'Incident not found', 'NOT_FOUND');
      const updated = await prisma.securityIncident.update({
        where: { id: existing.id },
        data: { officerNotified: true },
      });
      return res.json({ data: toPublic(updated) });
    } catch (err) {
      return next(err);
    }
  }
);

/* The property's designated POPIA Information Officer (P42 fields). */
complianceRouter.get('/officer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const properties = await prisma.property.findMany({
      where: { tenantId: req.tenantId },
      select: {
        id: true,
        name: true,
        popiaInformationOfficerName: true,
        popiaInformationOfficerEmail: true,
      },
    });
    return res.json({ data: properties });
  } catch (err) {
    return next(err);
  }
});
