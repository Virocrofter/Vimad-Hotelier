-- P40 (D7): gift vouchers — sell/redeem/refund with liability tracking.
CREATE TABLE IF NOT EXISTS "gift_vouchers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT,
  "code" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "purchaserName" TEXT NOT NULL,
  "purchaserEmail" TEXT NOT NULL,
  "recipientName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'sold',
  "paymentRef" TEXT,
  "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "soldById" TEXT,
  "redeemedAt" TIMESTAMP(3),
  "redeemedFolioId" TEXT,
  "refundedAt" TIMESTAMP(3),
  "refundReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gift_vouchers_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "gift_vouchers" ADD CONSTRAINT "gift_vouchers_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "gift_vouchers_tenant_code" ON "gift_vouchers"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "gift_vouchers_tenant_status" ON "gift_vouchers"("tenantId", "status");
