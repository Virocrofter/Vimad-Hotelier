/* apps/api/src/modules/leads/leads.routes.ts
 * [MARKETING-LEADS] Public, unauthenticated lead capture for the marketing
 * site. Mounted at /v1/public/leads behind publicLimiter in index.ts.
 * Phase 0+ of the marketing rebuild — replaces the fake setTimeout forms.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { validateBody } from '../../common/validate.js';
import { createLead, createLeadSchema } from './leads.service.js';

export const leadsRouter = Router();

/* POST /v1/public/leads — marketing-site form (contact / demo / quote / ebook) */
leadsRouter.post(
  '/',
  validateBody(createLeadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lead = await createLead(req.validatedBody as any);
      res.status(201).json({ data: { id: lead.id, received: true } });
    } catch (err) {
      next(err);
    }
  }
);
