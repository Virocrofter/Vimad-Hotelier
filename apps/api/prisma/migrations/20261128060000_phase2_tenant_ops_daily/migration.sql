-- Phase 2 (2026-11-28): TenantOpsDaily ops-aggregate read model (F-A20).
-- One row per tenant per day: contract/plan-resolved MRR (cents), footprint,
-- health band, logins. Powers Command Center, MRR history, churn/expansion
-- WITHOUT touching the 178-table OLTP schema. Raw table, TEXT ids.

CREATE TABLE IF NOT EXISTS "tenant_ops_daily" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "date" DATE NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "plan" TEXT NOT NULL DEFAULT '',
  "mrrCents" INTEGER NOT NULL DEFAULT 0,
  "rooms" INTEGER NOT NULL DEFAULT 0,
  "properties" INTEGER NOT NULL DEFAULT 0,
  "healthScore" INTEGER NOT NULL DEFAULT 0,
  "healthBand" TEXT NOT NULL DEFAULT 'new',
  "logins7d" INTEGER NOT NULL DEFAULT 0,
  "exceptions24h" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_ops_daily_tenant_date_key" UNIQUE ("tenantId", "date")
);
CREATE INDEX IF NOT EXISTS "tenant_ops_daily_date_idx" ON "tenant_ops_daily" ("date" DESC);
