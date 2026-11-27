-- P67: tenant-wide 2FA enforcement (Mews parity — mandatory 2FA with a
-- forced-setup flow for users who haven't enrolled yet).
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "require2fa" BOOLEAN NOT NULL DEFAULT false;
