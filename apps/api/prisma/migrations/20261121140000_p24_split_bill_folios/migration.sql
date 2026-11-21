-- P24: split bills per stay — drop the one-folio-per-reservation unique index.
-- The FK stays (many folios may reference one reservation); reservationId is
-- already nullable (20261027221000). Adds consumption-timestamp accounting
-- primitives: consumedAt (stamped at posting) + rebateOfId (rebates reference
-- the immutable original line). Replay-safe: index-drop + additive columns.
DROP INDEX IF EXISTS "folios_reservationId_key";
ALTER TABLE "folio_items" ADD COLUMN IF NOT EXISTS "consumedAt" TIMESTAMP(3);
ALTER TABLE "folio_items" ADD COLUMN IF NOT EXISTS "rebateOfId" TEXT;
