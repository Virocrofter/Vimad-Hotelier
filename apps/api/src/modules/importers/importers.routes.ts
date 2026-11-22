/* C5′ — importer routes: parse (columns + sample), run (dry_run | commit),
 * and the run log. Every run persists a report (P29). */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope, requirePermission } from '../auth/auth.middleware.js';
import { runImport, type ImportFormat } from './importers.service.js';
import { parseCsv } from './importers.service.js';

export const importersRouter = Router();
importersRouter.use(authMiddleware, tenantScope);

const FORMATS: ImportFormat[] = ['nightsbridge', 'semper', 'ical'];

function actorOf(req: Request): string | null {
  const u: any = (req as any).auth ?? {};
  return (u.userId ?? u.id ?? u.sub ?? null) as string | null;
}

importersRouter.post(
  '/parse',
  requirePermission('guest', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { format, content } = (req.body ?? {}) as any;
      if (!FORMATS.includes(format)) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'format must be nightsbridge | semper | ical',
          },
        });
      }
      if (!content || String(content).length > 2 * 1024 * 1024) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'content required, max 2MB' } });
      }
      if (format === 'ical') {
        const { parseICal } = await import('./importers.service.js');
        const events = parseICal(String(content)).slice(0, 20);
        return res.json({ data: { fields: Object.keys(events[0] ?? {}), sample: events } });
      }
      const grid = parseCsv(String(content));
      return res.json({ data: { columns: grid[0] ?? [], sample: grid.slice(1, 21) } });
    } catch (err) {
      return next(err);
    }
  }
);

importersRouter.post(
  '/run',
  requirePermission('guest', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { format, content, propertyId, mode } = (req.body ?? {}) as any;
      if (!FORMATS.includes(format)) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'format must be nightsbridge | semper | ical',
          },
        });
      }
      if (!content) {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'content is required' } });
      }
      if (mode !== 'dry_run' && mode !== 'commit') {
        return res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'mode must be dry_run | commit' } });
      }
      if (mode === 'commit' && !propertyId) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'propertyId is required for commit' },
        });
      }
      const data = await runImport(req.tenantId!, {
        format,
        content: String(content),
        propertyId: propertyId ? String(propertyId) : undefined,
        mode,
        actorId: actorOf(req),
      });
      return res.json({ data });
    } catch (err) {
      return next(err);
    }
  }
);

importersRouter.get(
  '/runs',
  requirePermission('guest', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await prisma.importRun.findMany({
        where: { tenantId: req.tenantId! },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          format: true,
          mode: true,
          report: true,
          createdAt: true,
          actorId: true,
        },
      });
      return res.json({ data: rows });
    } catch (err) {
      return next(err);
    }
  }
);
