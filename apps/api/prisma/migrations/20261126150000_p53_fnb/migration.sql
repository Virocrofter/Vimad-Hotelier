-- P53 (F3): QR order-and-pay orders.
CREATE TABLE IF NOT EXISTS "fnb_orders" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reference" TEXT NOT NULL,
  "paystackId" BIGINT,
  "email" TEXT,
  "tableLabel" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fnb_orders_reference_key" ON "fnb_orders"("reference");
CREATE INDEX IF NOT EXISTS "fnb_orders_tenant_status" ON "fnb_orders"("tenantId", "propertyId", "status");
