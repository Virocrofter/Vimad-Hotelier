-- P44: EFT proof-of-payment ledger (upload -> verify -> folio match).
CREATE TABLE IF NOT EXISTS "payment_proofs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "reference" TEXT,
  "note" TEXT,
  "fileId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "verifiedFolioId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "payment_proofs_tenant_reservation" ON "payment_proofs"("tenantId", "reservationId");
CREATE INDEX IF NOT EXISTS "payment_proofs_tenant_status" ON "payment_proofs"("tenantId", "status");
