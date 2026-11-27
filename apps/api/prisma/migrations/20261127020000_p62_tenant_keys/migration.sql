-- P62 (D-1/F-A21 block 1): per-tenant Paystack keys (hotel-owned accounts).
-- Secret is AES-256-GCM encrypted at rest; only decrypted at the chokepoints.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "paystackSecretEnc" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "paystackPublicKey" TEXT;
