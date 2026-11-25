-- P41 (D8): travel-agent contracts, attribution, cutoff groundwork.
ALTER TABLE "corporate_accounts" ADD COLUMN IF NOT EXISTS "isAgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "corporate_accounts" ADD COLUMN IF NOT EXISTS "commissionPct" DECIMAL(5,2);
ALTER TABLE "corporate_accounts" ADD COLUMN IF NOT EXISTS "cutoffDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "corporate_accounts" ADD COLUMN IF NOT EXISTS "netRateDiscountPct" DECIMAL(5,2);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "agentAccountId" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "agentAccountId" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_agentAccount_fkey" FOREIGN KEY ("agentAccountId") REFERENCES "corporate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_agentAccount_fkey" FOREIGN KEY ("agentAccountId") REFERENCES "corporate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "users_agentAccount" ON "users"("agentAccountId");
CREATE INDEX IF NOT EXISTS "reservations_agentAccount" ON "reservations"("agentAccountId");
