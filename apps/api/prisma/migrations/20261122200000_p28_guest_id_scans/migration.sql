-- P28: Digital-ID scan artifacts (C4′a). Content in storage (putFile); this
-- table holds extraction results + the POPIA retention expiry. Additive.
CREATE TABLE IF NOT EXISTS "guest_id_scans" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "extracted" JSONB,
  "status" TEXT NOT NULL DEFAULT 'processed',
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "guest_id_scans_tenantId_idx" ON "guest_id_scans"("tenantId");
CREATE INDEX IF NOT EXISTS "guest_id_scans_guestId_idx" ON "guest_id_scans"("guestId");
CREATE INDEX IF NOT EXISTS "guest_id_scans_expiresAt_idx" ON "guest_id_scans"("expiresAt");
ALTER TABLE "guest_id_scans" ADD CONSTRAINT "guest_id_scans_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
