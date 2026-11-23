-- P31 (7.1): task space-blocking + SLA/attachment/language additions.
-- dueAt/slaMinutes/slaBreached already shipped; these four are additive.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "blocksSpaceStatus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "escalateAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "sourceLanguage" TEXT;
