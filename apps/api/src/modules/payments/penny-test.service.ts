/* apps/api/src/modules/payments/penny-test.service.ts — D-1 hard gate: a
 * founding hotel does not take live guest payments until the penny test
 * (a R1 charge through THEIR keys) verifies. Live-key-gated by nature. */
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';
import { env } from '../../common/env.js';
import { newReference, initializeTransaction, verifyTransaction } from '../../common/paystack.js';
import { getTenantPaystackCredentials } from '../../common/tenant-paystack.js';
import { withPaystackCredentials } from '../../common/paystack.js';

const PENNY_MINOR = 100; // R1

export async function beginPennyTest(tenantId: string, actorEmail: string) {
  const creds = await getTenantPaystackCredentials(tenantId);
  if (!creds) {
    throw new AppError(
      400,
      'Connect your Paystack account first (no tenant keys on file)',
      'NO_TENANT_KEYS'
    );
  }
  const reference = newReference('PENNY');
  await prisma.tenant.update({ where: { id: tenantId }, data: { pennyTestReference: reference } });
  const checkout = await withPaystackCredentials(creds, () =>
    initializeTransaction({
      email: actorEmail,
      amountMinor: PENNY_MINOR,
      currency: env.PAYSTACK_CURRENCY,
      reference,
      callbackUrl: `${env.WEB_URL.replace(/\/$/, '')}/app/settings/payments`,
      metadata: { tenantId, kind: 'penny-test' },
    })
  );
  return { reference, authorizationUrl: checkout.authorization_url };
}

export async function verifyPennyTestByReference(reference: string) {
  const tenant = await prisma.tenant.findFirst({ where: { pennyTestReference: reference } });
  if (!tenant) throw new AppError(404, 'Penny test not found', 'NOT_FOUND');
  if (tenant.pennyTestAt) {
    return { ok: true, verifiedAt: tenant.pennyTestAt, already: true };
  }
  const creds = await getTenantPaystackCredentials(tenant.id);
  if (!creds) throw new AppError(400, 'No tenant keys on file', 'NO_TENANT_KEYS');
  const tx = await withPaystackCredentials(creds, () => verifyTransaction(reference));
  if (tx.status === 'success' && tx.amount === PENNY_MINOR) {
    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { pennyTestAt: new Date() },
    });
    return { ok: true, verifiedAt: updated.pennyTestAt, already: false };
  }
  throw new AppError(
    409,
    tx.gateway_response ?? 'Penny test not successful',
    'PENNY_NOT_SUCCESSFUL'
  );
}
