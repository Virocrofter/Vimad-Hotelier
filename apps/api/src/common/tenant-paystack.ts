/* apps/api/src/common/tenant-paystack.ts — per-tenant Paystack credential
 * resolution (D-1/F-A21). Returns null when the tenant hasn't connected
 * their own account → callers fall back to the platform context (or block,
 * per surface). Secrets are AES-GCM encrypted at rest. */
import { prisma } from './prisma.js';
import { decryptSecret } from './secrets.js';

export interface TenantPaystackCredentials {
  secretKey: string;
  publicKey: string | null;
}

export async function getTenantPaystackCredentials(
  tenantId: string
): Promise<TenantPaystackCredentials | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { paystackSecretEnc: true, paystackPublicKey: true },
  });
  if (!tenant?.paystackSecretEnc) return null;
  try {
    return {
      secretKey: decryptSecret(tenant.paystackSecretEnc),
      publicKey: tenant.paystackPublicKey ?? null,
    };
  } catch {
    return null; // corrupt ciphertext → platform fallback, observable via key absence
  }
}
