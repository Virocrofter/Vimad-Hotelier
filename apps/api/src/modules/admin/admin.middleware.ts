/* apps/api/src/modules/admin/admin.middleware.ts
 * Platform-admin guard (Phase 3a, 2026-11-28).
 * Identity source: internal_admin_users table (control-plane identities,
 * separate from hotel staff). Bootstrap: while the table is EMPTY the first
 * env-allowed email self-provisions as FOUNDER; once any row exists the table
 * wins and PLATFORM_ADMIN_EMAILS stops granting. Still fail-closed when BOTH
 * the table is empty AND the env is unset. */
import type { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware.js';
import { AppError } from '../../common/errors.js';
import { resolveAdminAccess, platformAdminEmails } from './internal-admin.service.js';

export async function requireAdminRole(req: Request, _res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  const email = (authReq.auth?.user?.email ?? '').toLowerCase();
  if (!email) {
    next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    return;
  }
  try {
    const admin = await resolveAdminAccess(email);
    if (!admin) {
      if (platformAdminEmails().length === 0) {
        next(
          new AppError(
            503,
            'PLATFORM_ADMIN_EMAILS is not configured; /admin is disabled (fail-closed)',
            'PLATFORM_ADMIN_UNSET'
          )
        );
        return;
      }
      next(new AppError(403, 'Platform admin only', 'FORBIDDEN'));
      return;
    }
    // Attach the control-plane identity for downstream role gates + audit.
    (req as any).internalAdmin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

/* Role gate for the delegation matrix (blueprint §04). Use AFTER requireAdminRole:
 *   adminRouter.post('/x', requireAdminRole, requireInternalRole('FOUNDER'), handler) */
export function requireInternalRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = (req as any).internalAdmin?.role;
    if (!role || !roles.includes(role)) {
      next(new AppError(403, 'Insufficient role: requires ' + roles.join(' or '), 'FORBIDDEN'));
      return;
    }
    next();
  };
}
