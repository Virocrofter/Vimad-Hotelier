-- P65: rich booking content — images + descriptions on rooms and catalog items.
ALTER TABLE "room_types" ADD COLUMN IF NOT EXISTS "imageKey" TEXT;
ALTER TABLE "room_types" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "upsell_products" ADD COLUMN IF NOT EXISTS "imageKey" TEXT;
ALTER TABLE "upsell_products" ADD COLUMN IF NOT EXISTS "description" TEXT;
