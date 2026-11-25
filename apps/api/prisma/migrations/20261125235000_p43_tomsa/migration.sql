-- P43: TOMSA 1% tourism levy opt-in on properties.
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "tomsaLevyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "tomsaAccountCode" TEXT;
