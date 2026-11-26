-- P60: preauthorization holds — open → captured | voided, claim-idempotent.
CREATE TABLE IF NOT EXISTS "preauths" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL DEFAULT 'open',
  "reference" TEXT NOT NULL,
  "authorizationCode" TEXT,
  "authorizationTransactionId" BIGINT,
  "captureReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "capturedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  CONSTRAINT "preauths_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "preauths_reference_key" ON "preauths"("reference");
CREATE INDEX IF NOT EXISTS "preauths_reservation" ON "preauths"("tenantId", "reservationId", "status");
