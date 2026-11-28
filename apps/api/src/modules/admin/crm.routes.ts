/* apps/api/src/modules/admin/crm.routes.ts — founder-side CRM funnel.
 * Mounted at /admin/crm after authMiddleware + requireAdminRole. */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { listLeads, updateLead, convertLead, LEAD_STATUSES } from './crm.service.js';

export const crmRouter = Router();

crmRouter.get('/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(await listLeads(req.query as Record<string, string>));
  } catch (err) {
    return next(err);
  }
});

const LeadPatchSchema = z.object({
  status: z.enum(LEAD_STATUSES as unknown as [string, ...string[]]).optional(),
  zone: z.string().max(10).optional(),
  walkInNotes: z.string().max(4000).optional(),
  name: z.string().max(120).optional(),
  phone: z.string().max(24).optional(),
  propertyName: z.string().max(160).optional(),
  roomCount: z.coerce.number().int().min(1).max(5000).optional(),
  currentPms: z.string().max(120).optional(),
});

crmRouter.patch('/leads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LeadPatchSchema.parse(req.body ?? {});
    return res.json(await updateLead(req.params.id, body));
  } catch (err) {
    return next(err);
  }
});

crmRouter.post('/leads/:id/convert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = (req as any).internalAdmin;
    return res.json(await convertLead(req.params.id, admin.email));
  } catch (err) {
    return next(err);
  }
});
