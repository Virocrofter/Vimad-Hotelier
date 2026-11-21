-- P26: reservation document repository — metadata + storage via putFile
-- (storage-agnostic: local ./storage or S3 by STORAGE_PROVIDER).
CREATE TABLE IF NOT EXISTS "reservation_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'other',
  "signatureStatus" TEXT NOT NULL DEFAULT 'n_a',
  "signedAt" TIMESTAMP(3),
  "deadline" TIMESTAMP(3),
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "reservation_documents_reservationId_idx" ON "reservation_documents"("reservationId");
CREATE INDEX IF NOT EXISTS "reservation_documents_tenantId_idx" ON "reservation_documents"("tenantId");
ALTER TABLE "reservation_documents" ADD CONSTRAINT "reservation_documents_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
