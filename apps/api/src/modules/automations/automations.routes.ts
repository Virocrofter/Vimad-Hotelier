/* apps/api/src/modules/automations/automations.routes.ts — workflow CRUD,
 * manual fire, run inspection, storage. */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  resumeDueRuns,
  listRuns,
  getRun,
  storageSet,
  storageGet,
} from './automation.service.js';

export const automationsRouter = Router();

automationsRouter.use(authMiddleware, tenantScope);

const stepSchema = z.object({
  type: z.enum(['condition', 'delay', 'action']),
  config: z.record(z.string(), z.unknown()),
});

automationsRouter.get('/workflows', requirePermission('ticket', 'read'), async (req, res, next) => {
  try {
    res.json({ data: await listWorkflows(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

automationsRouter.post(
  '/workflows',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z
        .object({
          name: z.string().min(1).max(120),
          description: z.string().max(500).optional(),
          triggerType: z.enum(['event', 'cron', 'manual']),
          eventKey: z.string().max(80).optional(),
          cronMinutes: z.number().int().min(1).optional(),
          propertyId: z.string().optional(),
          steps: z.array(stepSchema).min(1),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid workflow',
          },
        });
        return;
      }
      const data = await createWorkflow(req.tenantId, parsed.data);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

automationsRouter.get(
  '/workflows/:id',
  requirePermission('ticket', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await getWorkflow(req.tenantId, String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  }
);

automationsRouter.post(
  '/workflows/:id/fire',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const wf = await getWorkflow(req.tenantId, String(req.params.id));
      const payload = (req.body?.payload ?? {}) as Record<string, unknown>;
      const run = await prisma.automationRun.create({
        data: {
          tenantId: req.tenantId,
          workflowId: wf.id,
          status: 'running',
          triggerPayload: { ...payload, workflowId: wf.id } as never,
        },
      });
      const { executeRunForRoutes } = await import('./automation.service.js');
      const executed = await executeRunForRoutes(run.id);
      res.json({ data: { fired: 1, runs: [executed] } });
    } catch (err) {
      next(err);
    }
  }
);

automationsRouter.get(
  '/runs',
  requirePermission('ticket', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string>;
      res.json({ data: await listRuns(req.tenantId, q.workflowId) });
    } catch (err) {
      next(err);
    }
  }
);

automationsRouter.get(
  '/runs/:id',
  requirePermission('ticket', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await getRun(req.tenantId, String(req.params.id)) });
    } catch (err) {
      next(err);
    }
  }
);

automationsRouter.post(
  '/runs/resume-due',
  requirePermission('ticket', 'update'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await resumeDueRuns() });
    } catch (err) {
      next(err);
    }
  }
);

automationsRouter.put(
  '/storage/:key',
  requirePermission('ticket', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await storageSet(req.tenantId, String(req.params.key), req.body?.value);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }
);

automationsRouter.get(
  '/storage/:key',
  requirePermission('ticket', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await storageGet(req.tenantId, String(req.params.key)) });
    } catch (err) {
      next(err);
    }
  }
);
