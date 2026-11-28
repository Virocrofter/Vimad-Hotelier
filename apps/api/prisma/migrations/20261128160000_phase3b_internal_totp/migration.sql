-- Phase 3b (2026-11-28): internal-admin TOTP enrolment needs a pending
-- secret column (same pattern as users.totpPendingSecret).

ALTER TABLE "internal_admin_users"
  ADD COLUMN IF NOT EXISTS "totpPendingSecret" TEXT;
