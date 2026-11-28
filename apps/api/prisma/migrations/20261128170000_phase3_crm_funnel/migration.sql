-- Phase 3 (2026-11-28): CRM / Durban funnel on top of the marketing leads
-- table. Table name resolved dynamically (Prisma default "Lead").

DO $$
DECLARE t TEXT;
BEGIN
  SELECT table_name INTO t FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name IN ('Lead', 'leads') LIMIT 1;
  IF t IS NULL THEN RAISE EXCEPTION 'leads table not found'; END IF;
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "zone" TEXT', t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT ''new''', t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "walkInNotes" TEXT', t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "demoSessionId" TEXT', t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMPTZ', t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMPTZ', t);
  EXECUTE format('CREATE INDEX IF NOT EXISTS "lead_status_idx" ON %I ("status", "createdAt")', t);
END $$;
