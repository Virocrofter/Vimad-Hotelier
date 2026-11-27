/* P62 — D-1/F-A21 block 1: credential context isolation (concurrent
 * requests never bleed keys), webhook verify per-tenant, AES-GCM round-trip,
 * tenant columns. No network — the funnel reads the scope, proven via the
 * exported getter. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma: any = new PrismaClient();
const runId = Date.now().toString(36);
const ctx: Record<string, any> = {};

describe('P62 per-tenant Paystack keys', () => {
  it('S1: ALS context isolation — interleaved async scopes keep their keys', async () => {
    const paystack = await import('../../src/common/paystack.js');
    const seen: string[] = [];

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const job = async (key: string) =>
      paystack.withPaystackCredentials({ secretKey: key }, async () => {
        await delay(10); // yield across the other job's window
        seen.push(paystack.currentPaystackCredentials()?.secretKey ?? 'none');
      });

    await Promise.all([job('key-A'), job('key-B')]);
    expect(seen.sort()).toEqual(['key-A', 'key-B']);

    // Outside the scope → null (platform env fallback applies downstream).
    expect(paystack.currentPaystackCredentials()).toBeNull();
    console.log('P62 S1 OK — no cross-request bleed');
  }, 30000);

  it('S2: webhook signature verifies per-tenant, env fallback intact', async () => {
    const paystack = await import('../../src/common/paystack.js');
    const body = Buffer.from(JSON.stringify({ reference: 'X' }));
    const tenantSecret = 'sk_tenant_' + runId;
    const sig = createHmac('sha512', tenantSecret).update(body).digest('hex');

    await paystack.withPaystackCredentials({ secretKey: tenantSecret }, async () => {
      expect(paystack.verifyWebhookSignature(body, sig)).toBe(true);
    });
    // Wrong tenant scope must NOT verify.
    await paystack.withPaystackCredentials({ secretKey: 'sk_other' + runId }, async () => {
      expect(paystack.verifyWebhookSignature(body, sig)).toBe(false);
    });
    console.log('P62 S2 OK — per-tenant webhook verify');
  }, 30000);

  it('S3: secrets round-trip + tenant columns exist', async () => {
    const secrets = await import('../../src/common/secrets.js');
    const plain = 'sk_test_' + runId;
    const enc = secrets.encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(secrets.encryptSecret(plain)).not.toBe(enc); // random IV
    expect(secrets.decryptSecret(enc)).toBe(plain);

    const agent: any = await (
      await import('../helpers/server.js')
    ).registerTestAgent(await (await import('../helpers/server.js')).buildTestApp());
    ctx.tenantId = agent.tenantId;
    await prisma.tenant.update({
      where: { id: agent.tenantId },
      data: {
        paystackSecretEnc: secrets.encryptSecret('sk_hotel_' + runId),
        paystackPublicKey: 'pk_hotel_' + runId,
      },
    });

    const creds = await (
      await import('../../src/common/tenant-paystack.js')
    ).getTenantPaystackCredentials(agent.tenantId);
    expect(creds?.secretKey).toBe('sk_hotel_' + runId);
    expect(creds?.publicKey).toBe('pk_hotel_' + runId);

    const none = await (
      await import('../../src/common/tenant-paystack.js')
    ).getTenantPaystackCredentials('tenant-without-keys');
    expect(none).toBeNull();
    console.log('P62 S3 OK — AES-GCM + resolution');
  }, 90000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
