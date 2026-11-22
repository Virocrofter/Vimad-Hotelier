-- P30: BI hub saved views (6.2) — the honest cheap tier of the cut dashboard
-- builder. Per-user, per-property filter-state snapshots. Additive.
CREATE TABLE IF NOT EXISTS "saved_views" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "propertyId" TEXT,
  "name" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "saved_views_tenantId_idx" ON "saved_views"("tenantId");
