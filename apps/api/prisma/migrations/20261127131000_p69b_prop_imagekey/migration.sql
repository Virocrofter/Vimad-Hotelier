-- P69b: properties.imageKey (sisters card hero photo) — missed in the p69 batch.
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "imageKey" TEXT;
