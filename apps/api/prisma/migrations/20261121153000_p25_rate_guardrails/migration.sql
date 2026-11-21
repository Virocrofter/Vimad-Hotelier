-- P25: per-plan rate guardrails — fat-fingered bulk updates and single-cell
-- overrides cannot publish out-of-range rates. Additive + replay-safe.
ALTER TABLE "rate_plans" ADD COLUMN IF NOT EXISTS "rateFloor" DECIMAL(10,2);
ALTER TABLE "rate_plans" ADD COLUMN IF NOT EXISTS "rateCeiling" DECIMAL(10,2);
