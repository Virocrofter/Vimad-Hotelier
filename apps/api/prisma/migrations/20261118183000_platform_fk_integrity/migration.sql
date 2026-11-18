-- Phase 4 drift close-out: add FKs the platform layer code assumed but
-- migrations never created. Orphan demo_activity rows purged first.
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demo_invites" ADD CONSTRAINT "demo_invites_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demo_activity" ADD CONSTRAINT "demo_activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "demo_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
