-- P29: importer run log (C5′). Every parse/dry-run/commit is persisted —
-- zero silent failures. Additive, replay-safe.
CREATE TABLE IF NOT EXISTS "import_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT,
  "format" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "report" JSONB,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "import_runs_tenantId_createdAt_idx" ON "import_runs"("tenantId", "createdAt");
