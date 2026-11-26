/* apps/api/src/modules/fnb/fnb.tables.routes.ts — F1/F2 venue tables.
 * Bind a till check to a table, walk the dining flow, free the table.
 * One open check per table; closed checks can't be seated. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';

export const fnbTablesRouter = Router();

fnbTablesRouter.use(authMiddleware, tenantScope);

fnbTablesRouter.get('/', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const rows = await prisma.fnBTable.findMany({
      where: {
        tenantId: req.tenantId,
        ...(q.propertyId ? { propertyId: q.propertyId } : {}),
        ...(q.status ? { status: q.status } : {}),
      },
      orderBy: [{ area: 'asc' }, { label: 'asc' }],
      take: 200,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

fnbTablesRouter.post(
  '/',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          propertyId: z.string().min(1),
          label: z.string().min(1).max(30),
          area: z.string().max(40).optional(),
          seats: z.number().int().min(1).max(30).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'propertyId + label required' } });
        return;
      }
      const dup = await prisma.fnBTable.findFirst({
        where: {
          tenantId: req.tenantId,
          propertyId: parsed.data.propertyId,
          label: parsed.data.label,
        },
      });
      if (dup) throw new AppError(409, 'A table with that label already exists', 'DUPLICATE_LABEL');
      const data = await prisma.fnBTable.create({
        data: { tenantId: req.tenantId, ...parsed.data, status: 'free' },
      });
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

fnbTablesRouter.post(
  '/:id/seat',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ checkId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'checkId required' } });
        return;
      }
      const table = await prisma.fnBTable.findFirst({
        where: { id: String(req.params.id), tenantId: req.tenantId },
      });
      if (!table) throw new AppError(404, 'Table not found', 'NOT_FOUND');
      if (table.status !== 'free') {
        throw new AppError(409, `Table is ${table.status} — free it first`, 'TABLE_BUSY');
      }
      const check = await prisma.tillCheck.findFirst({
        where: { id: parsed.data.checkId, tenantId: req.tenantId },
      });
      if (!check) throw new AppError(404, 'Check not found', 'NOT_FOUND');
      if (check.status !== 'open')
        throw new AppError(409, 'Only open checks can be seated', 'CHECK_CLOSED');
      if (check.propertyId !== table.propertyId) {
        throw new AppError(409, 'Check and table belong to different properties', 'CROSS_PROPERTY');
      }
      const data = await prisma.fnBTable.update({
        where: { id: table.id },
        data: { status: 'seated', checkId: check.id },
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

const FLOW: Record<string, string> = { seated: 'ordered', ordered: 'served' };

fnbTablesRouter.post(
  '/:id/status',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ status: z.enum(['ordered', 'served']) }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
        return;
      }
      const table = await prisma.fnBTable.findFirst({
        where: { id: String(req.params.id), tenantId: req.tenantId },
      });
      if (!table) throw new AppError(404, 'Table not found', 'NOT_FOUND');
      if (FLOW[table.status] !== parsed.data.status) {
        throw new AppError(
          409,
          `Cannot move a ${table.status} table to ${parsed.data.status}`,
          'INVALID_TRANSITION'
        );
      }
      const data = await prisma.fnBTable.update({
        where: { id: table.id },
        data: { status: parsed.data.status },
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

fnbTablesRouter.post(
  '/:id/free',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const table = await prisma.fnBTable.findFirst({
        where: { id: String(req.params.id), tenantId: req.tenantId },
      });
      if (!table) throw new AppError(404, 'Table not found', 'NOT_FOUND');
      if (table.status === 'free') throw new AppError(409, 'Table is already free', 'ALREADY_FREE');
      const data = await prisma.fnBTable.update({
        where: { id: table.id },
        data: { status: 'free', checkId: null },
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);
