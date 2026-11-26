-- P57 (O1): hotel-wide stores — inter-outlet stock transfers.
CREATE TABLE IF NOT EXISTS "stock_transfers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fromItemId" TEXT NOT NULL,
  "toItemId" TEXT NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "note" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stock_transfers_tenant" ON "stock_transfers"("tenantId", "createdAt");
