-- P22: key issuance registry — hand-authored (migrate dev banned on this repo).
CREATE TABLE "key_issuances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestName" TEXT,
    "issuedBy" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_issuances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "key_issuances_tenantId_propertyId_status_idx" ON "key_issuances"("tenantId", "propertyId", "status");
CREATE INDEX "key_issuances_roomId_status_idx" ON "key_issuances"("roomId", "status");

ALTER TABLE "key_issuances" ADD CONSTRAINT "key_issuances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_issuances" ADD CONSTRAINT "key_issuances_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_issuances" ADD CONSTRAINT "key_issuances_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_issuances" ADD CONSTRAINT "key_issuances_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
