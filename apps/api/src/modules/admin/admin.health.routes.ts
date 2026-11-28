import { Router } from 'express';
import { z } from 'zod';
import { requireAdminRole } from './admin.middleware.js';
import * as health from './admin.health.service.js';
import * as opsDaily from './ops-daily.service.js';

export const adminHealthRouter = Router();
const wrap = (fn: any) => async (req: any, res: any) => {
  try {
    res.json({ data: await fn(req) });
  } catch (err: any) {
    req.log?.error?.({ err }, 'admin health route failed');
    res.status(500).json({ error: err?.message || 'health error' });
  }
};

adminHealthRouter.get(
  '/health/overview',
  requireAdminRole,
  wrap(async () => health.getHealthOverview())
);
adminHealthRouter.get(
  '/health/heartbeats',
  requireAdminRole,
  wrap(async () => health.getHeartbeats())
);
adminHealthRouter.get(
  '/health/probes',
  requireAdminRole,
  wrap(async () => health.getProbes())
);
adminHealthRouter.post(
  '/health/probes/run',
  requireAdminRole,
  wrap(async () => health.runProbes())
);
adminHealthRouter.get(
  '/health/incidents',
  requireAdminRole,
  wrap(async () => health.getIncidents())
);
adminHealthRouter.post(
  '/health/incidents',
  requireAdminRole,
  wrap(async (req: any) => {
    const body = z
      .object({
        title: z.string().min(3),
        severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      })
      .parse(req.body);
    return health.createIncident(body);
  })
);
adminHealthRouter.patch(
  '/health/incidents/:id',
  requireAdminRole,
  wrap(async (req: any) => {
    const body = z
      .object({ status: z.string().optional(), note: z.string().optional() })
      .parse(req.body);
    return health.updateIncident(req.params.id, body);
  })
);
adminHealthRouter.get(
  '/health/tenants',
  requireAdminRole,
  wrap(async () => health.getTenantScores())
);
adminHealthRouter.get(
  '/health/tenants/:id',
  requireAdminRole,
  wrap(async (req: any) => health.getTenantHealthDetail(req.params.id))
);

adminHealthRouter.get(
  '/health/tenants/:id/snapshots',
  requireAdminRole,
  wrap(async (req: any) => health.getTenantSnapshots(req.params.id, Number(req.query.days ?? 30)))
);

/* TenantOpsDaily: fleet MRR series + day-over-day movement (F-A20) */
adminHealthRouter.get(
  '/health/ops-daily',
  requireAdminRole,
  wrap(async (req: any) => opsDaily.getFleetDaily(Number(req.query.days ?? 30)))
);

adminHealthRouter.get(
  '/health/ops-daily/:tenantId',
  requireAdminRole,
  wrap(async (req: any) =>
    opsDaily.getTenantDaily(req.params.tenantId, Number(req.query.days ?? 90))
  )
);
adminHealthRouter.get(
  '/health/journeys',
  requireAdminRole,
  wrap(async () => health.getJourneys())
);
adminHealthRouter.get(
  '/health/nightly',
  requireAdminRole,
  wrap(async () => health.getNightly())
);
