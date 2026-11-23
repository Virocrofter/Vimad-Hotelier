-- P32 follow-up: name the lost_found_items FKs per Prisma's convention so
-- `prisma migrate diff` reports zero drift (names only — no behavior change).
ALTER TABLE "lost_found_items" DROP CONSTRAINT IF EXISTS "lfk_lost_found_tenant";
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lost_found_items" DROP CONSTRAINT IF EXISTS "lfk_lost_found_property";
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lost_found_items" DROP CONSTRAINT IF EXISTS "lfk_lost_found_room";
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_foundRoomId_fkey" FOREIGN KEY ("foundRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lost_found_items" DROP CONSTRAINT IF EXISTS "lfk_lost_found_guest";
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lost_found_items" DROP CONSTRAINT IF EXISTS "lfk_lost_found_reservation";
ALTER TABLE "lost_found_items" ADD CONSTRAINT "lost_found_items_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
