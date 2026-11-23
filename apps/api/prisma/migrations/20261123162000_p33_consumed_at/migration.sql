-- P33: consumption-timestamp accounting — backfill consumed_at from posted_at.
UPDATE "folio_items" SET "consumedAt" = "postedAt" WHERE "consumedAt" IS NULL;
