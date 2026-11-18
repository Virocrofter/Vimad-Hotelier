-- REPLAY-SAFE REPAIR (2026-11-18): preamble creates the hand-era tables (never created
-- by any migration). FKs below are guarded by referenced-table existence: at this
-- lexical position (2026... sorts BEFORE all P-named migrations) contracts/demo_sessions
-- do not exist yet on fresh replay. P99_platform_fk_integrity_replay_safe re-adds them
-- idempotently in correct order. On the live DB this migration is already applied.

CREATE TABLE IF NOT EXISTS public.contract_events (
    id text NOT NULL,
    "contractId" text NOT NULL,
    type text NOT NULL,
    payload jsonb,
    actor text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.demo_invites (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "tokenPrefix" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.demo_activity (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    "tenantId" text,
    actor text,
    action text NOT NULL,
    detail text,
    meta jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.accounting_configs (
    "propertyId" text NOT NULL,
    mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    "updatedById" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS public.exception_cadence_lease (
    id integer NOT NULL,
    locked_at timestamp with time zone DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone NOT NULL
);

DO $$
BEGIN
  IF to_regclass('public."contracts"') IS NOT NULL THEN
    ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."demo_sessions"') IS NOT NULL THEN
    ALTER TABLE "demo_invites" ADD CONSTRAINT "demo_invites_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."demo_sessions"') IS NOT NULL THEN
    ALTER TABLE "demo_activity" ADD CONSTRAINT "demo_activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
