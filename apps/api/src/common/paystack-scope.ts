/* apps/api/src/common/paystack-scope.ts — request-scoped tenant credential
 * scope (D-1/F-A21). Mounted after auth+tenantScope on payment routers:
 * every downstream Paystack call in the request rides the tenant's own
 * keys (5-minute cache), falling back to the platform context when the
 * tenant has not connected an account. */
import type { Request, Response, NextFunction } from 'express';
import { getTenantPaystackCredentials } from './tenant-paystack.js';
import { withPaystackCredentials, type PaystackCredentials } from './paystack.js';

const cache = new Map<string, { creds: PaystackCredentials | null; at: number }>();
const TTL = 5 * 60_000;

async function cached(tenantId: string): Promise<PaystackCredentials | null> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL) return hit.creds;
  const creds = await getTenantPaystackCredentials(tenantId);
  cache.set(tenantId, { creds, at: Date.now() });
  return creds;
}

export function invalidatePaystackScope(tenantId: string) {
  cache.delete(tenantId);
}

export function paystackTenantScope(req: Request, res: Response, next: NextFunction) {
  const tenantId = String((req as { tenantId?: string }).tenantId ?? '');
  if (!tenantId) return next();
  cached(tenantId)
    .then((creds) => {
      if (!creds) return next();
      withPaystackCredentials(
        creds,
        () =>
          new Promise<void>((resolve) => {
            res.on('finish', () => resolve());
            next();
          })
      ).catch(() => undefined);
    })
    .catch(() => next());
}
