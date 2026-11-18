-- REPLAY-SAFE PREAMBLE: these tables exist in the live DB but were never created
-- by any migration (hand-repaired baseline era). Without these, replaying the chain on a
-- fresh shadow DB fails with P3006 before this migration's FKs apply. No-op on the live DB.

CREATE TABLE IF NOT EXISTS public.contract_events (
    id text NOT NULL,
    "contractId" text NOT NULL,
    type text NOT NULL,
    payload jsonb,
    actor text NOT NULL,
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

-- Phase 4 drift close-out: add FKs the platform layer code assumed but
-- migrations never created. Orphan demo_activity rows purged first.
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demo_invites" ADD CONSTRAINT "demo_invites_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demo_activity" ADD CONSTRAINT "demo_activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
