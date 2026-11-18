-- Idempotent completion of 20261118183000_platform_fk_integrity. At this position (after ALL
-- P-named migrations) the referenced tables exist on fresh replay. On the live DB these
-- constraints already exist, so every statement is a verified no-op.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_events_contractId_fkey') THEN
    ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demo_invites_sessionId_fkey') THEN
    ALTER TABLE "demo_invites" ADD CONSTRAINT "demo_invites_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demo_activity_sessionId_fkey') THEN
    ALTER TABLE "demo_activity" ADD CONSTRAINT "demo_activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
