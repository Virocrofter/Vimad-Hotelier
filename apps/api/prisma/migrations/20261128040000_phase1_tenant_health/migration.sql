-- Phase 1 (2026-11-28): tenant health v2 + auth telemetry.
-- Raw tables (not Prisma models), TEXT ids per codebase convention,
-- accessed via $queryRawUnsafe like the rest of the health service.

CREATE TABLE IF NOT EXISTS "auth_events" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'login',
  "at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "auth_events_tenant_at_idx" ON "auth_events" ("tenantId", "at" DESC);
CREATE INDEX IF NOT EXISTS "auth_events_user_at_idx" ON "auth_events" ("userId", "at" DESC);

CREATE TABLE IF NOT EXISTS "tenant_health_snapshots" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "tenantId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "score" INTEGER NOT NULL,
  "band" TEXT NOT NULL,
  "subScores" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "triggers" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "weightsVersion" TEXT NOT NULL,
  "computedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_health_snapshots_tenant_date_key" UNIQUE ("tenantId", "date")
);
CREATE INDEX IF NOT EXISTS "tenant_health_snapshots_date_idx" ON "tenant_health_snapshots" ("date" DESC);
