-- Phase 3a (2026-11-28): control-plane identities + impersonation sessions.
-- Raw tables (blueprint §05 InternalAdminUser / ImpersonationSession),
-- TEXT ids per convention. Control-plane identities are SEPARATE from
-- hotel-staff accounts by design.

CREATE TABLE IF NOT EXISTS "internal_admin_users" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "email" TEXT NOT NULL,
  "fullName" TEXT,
  "role" TEXT NOT NULL DEFAULT 'FOUNDER',
  "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  "totpSecret" TEXT,
  "allowedIps" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "provisionedFromEnv" BOOLEAN NOT NULL DEFAULT false,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "internal_admin_users_email_lower_key"
  ON "internal_admin_users" (lower(email));

CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "adminEmail" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'READ_ONLY',
  "ticket" TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "endedAt" TIMESTAMPTZ,
  "ipAddress" TEXT
);
CREATE INDEX IF NOT EXISTS "impersonation_sessions_admin_idx"
  ON "impersonation_sessions" ("adminEmail", "endedAt");
CREATE INDEX IF NOT EXISTS "impersonation_sessions_tenant_idx"
  ON "impersonation_sessions" ("tenantId", "startedAt" DESC);
