-- P27: win-back open tracking (H3-V). Additive, replay-safe.
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
