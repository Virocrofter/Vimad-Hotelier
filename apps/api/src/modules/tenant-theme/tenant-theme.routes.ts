/* apps/api/src/modules/tenant-theme/tenant-theme.routes.ts — DS-12: the
 * white-label theme contract (accent, focus ring, radius, logo slot).
 * Owner/admin manage; the widget reads the public theme by property code. */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/prisma.js';
import { authMiddleware, tenantScope } from '../auth/auth.middleware.js';

export const tenantThemeRouter = Router();

tenantThemeRouter.use(authMiddleware, tenantScope);

const themeSchema = z.object({
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'accent must be a #rrggbb hex')
    .optional(),
  ring: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'ring must be a #rrggbb hex')
    .nullable()
    .optional(),
  radiusPx: z.number().int().min(0).max(32).nullable().optional(),
  logoKey: z.string().max(300).nullable().optional(),
  isActive: z.boolean().optional(),
});

const ownerOrAdmin = (req: any, res: any, next: any) => {
  const role = String(req.auth?.user?.role ?? '');
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Owner/admin only' } });
  }
  return next();
};

tenantThemeRouter.get('/', ownerOrAdmin, async (req, res, next) => {
  try {
    const theme = await prisma.tenantTheme.findFirst({ where: { tenantId: req.tenantId } });
    res.json({ data: theme });
  } catch (err) {
    next(err);
  }
});

tenantThemeRouter.put('/', ownerOrAdmin, async (req, res, next) => {
  try {
    const parsed = themeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid theme',
        },
      });
      return;
    }
    const existing = await prisma.tenantTheme.findFirst({ where: { tenantId: req.tenantId } });
    if (!existing) {
      if (!parsed.data.accent) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'First save needs an accent' } });
        return;
      }
      const created = await prisma.tenantTheme.create({
        data: {
          tenantId: req.tenantId,
          accent: parsed.data.accent,
          ring: parsed.data.ring ?? null,
          radiusPx: parsed.data.radiusPx ?? null,
          logoKey: parsed.data.logoKey ?? null,
          isActive: parsed.data.isActive ?? true,
        },
      });
      res.status(201).json({ data: created });
      return;
    }
    const data: Record<string, unknown> = {};
    if (parsed.data.accent !== undefined) data.accent = parsed.data.accent;
    if (parsed.data.ring !== undefined) data.ring = parsed.data.ring;
    if (parsed.data.radiusPx !== undefined) data.radiusPx = parsed.data.radiusPx;
    if (parsed.data.logoKey !== undefined) data.logoKey = parsed.data.logoKey;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    const updated = await prisma.tenantTheme.update({ where: { id: existing.id }, data });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
