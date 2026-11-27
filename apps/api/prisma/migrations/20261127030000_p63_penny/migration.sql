-- P63 (D-1 block 2): penny-test reference + verified-at stamp on tenants.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "pennyTestReference" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "pennyTestAt" TIMESTAMP(3);
