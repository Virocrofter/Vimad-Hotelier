-- P55 (F1/F2): venue table management for the native till.
CREATE TABLE IF NOT EXISTS "fnb_tables" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "area" TEXT,
  "seats" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'free',
  "checkId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_tables_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fnb_tables_property" ON "fnb_tables"("tenantId", "propertyId", "status");
