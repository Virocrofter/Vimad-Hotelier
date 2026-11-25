-- P46: TOTP two-factor fields on users.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpPendingSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
