-- P54 (F5): native till — checks, line items, tenders, cash-up sessions.
CREATE TABLE IF NOT EXISTS "till_checks" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "openedById" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "totalCharges" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalComps" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "till_checks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "till_checks_tenant_status" ON "till_checks"("tenantId", "propertyId", "status");

CREATE TABLE IF NOT EXISTS "till_check_items" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "checkId" TEXT NOT NULL,
  "productId" TEXT,
  "name" TEXT NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "comped" BOOLEAN NOT NULL DEFAULT false,
  "compReason" TEXT,
  "reversed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "till_check_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "till_items_check" ON "till_check_items"("checkId");

CREATE TABLE IF NOT EXISTS "till_payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "checkId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "folioItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "till_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "till_payments_check" ON "till_payments"("checkId");

CREATE TABLE IF NOT EXISTS "till_sessions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "openedById" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "openingFloatMinor" INTEGER NOT NULL DEFAULT 0,
  "countedCashMinor" INTEGER,
  "expectedCashMinor" INTEGER,
  "varianceMinor" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "till_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "till_sessions_property" ON "till_sessions"("tenantId", "propertyId", "status");
