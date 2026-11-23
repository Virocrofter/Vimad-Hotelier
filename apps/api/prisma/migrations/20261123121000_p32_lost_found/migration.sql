-- P32 (7.8): Lost & Found item registry linked to the departed guest's reservation.
CREATE TABLE IF NOT EXISTS "lost_found_items" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "foundRoomId" TEXT,
  "foundLocation" TEXT,
  "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "photoUrls" JSONB,
  "status" TEXT NOT NULL DEFAULT 'found',
  "guestId" TEXT,
  "reservationId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "disposedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lost_found_items_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lfk_lost_found_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lfk_lost_found_property" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lfk_lost_found_room" FOREIGN KEY ("foundRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lfk_lost_found_guest" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lfk_lost_found_reservation" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "lost_found_items_tenant_status" ON "lost_found_items"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "lost_found_items_tenant_property" ON "lost_found_items"("tenantId", "propertyId");
