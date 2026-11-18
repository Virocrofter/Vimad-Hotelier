-- P98: live-structure completion. Everything the hand-era live DB carries that
-- migration history never produced (captured via migrate diff --from-migrations
-- --to-schema-datamodel, 38-line gap). Every statement is guarded — on the
-- live DB all are verified no-ops; on fresh replay they complete the chain.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_configs_pkey') THEN ALTER TABLE "accounting_configs" ADD CONSTRAINT "accounting_configs_pkey" PRIMARY KEY ("propertyId"); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_events_pkey') THEN ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_pkey" PRIMARY KEY ("id"); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demo_activity_pkey') THEN ALTER TABLE "demo_activity" ADD CONSTRAINT "demo_activity_pkey" PRIMARY KEY ("id"); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demo_invites_pkey') THEN ALTER TABLE "demo_invites" ADD CONSTRAINT "demo_invites_pkey" PRIMARY KEY ("id"); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exception_cadence_lease_pkey') THEN ALTER TABLE "exception_cadence_lease" ADD CONSTRAINT "exception_cadence_lease_pkey" PRIMARY KEY ("id"); END IF; END $$;

ALTER TABLE "backup_runs" ADD COLUMN IF NOT EXISTS "restoreTestedLog" TEXT;
ALTER TABLE "backup_runs" ADD COLUMN IF NOT EXISTS "restoreTestedStatus" TEXT;

-- value type: fires only on replayed/old DBs; the live column is already boolean
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feature_flag_overrides' AND column_name = 'value' AND data_type <> 'boolean') THEN
    ALTER TABLE "feature_flag_overrides" DROP COLUMN "value";
    ALTER TABLE "feature_flag_overrides" ADD COLUMN "value" BOOLEAN NOT NULL;
  END IF;
END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'guest_consents_guestId_fkey') THEN ALTER TABLE "guest_consents" ADD CONSTRAINT "guest_consents_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exceptions_tenantId_fkey') THEN ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_configs_propertyId_fkey') THEN ALTER TABLE "accounting_configs" ADD CONSTRAINT "accounting_configs_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'guest_consents_guest_purpose_idx') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'guest_consents_guestId_purpose_channel_capturedAt_idx') THEN EXECUTE 'ALTER INDEX "guest_consents_guest_purpose_idx" RENAME TO "guest_consents_guestId_purpose_channel_capturedAt_idx"'; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'guest_consents_tenant_idx') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'guest_consents_tenantId_idx') THEN EXECUTE 'ALTER INDEX "guest_consents_tenant_idx" RENAME TO "guest_consents_tenantId_idx"'; END IF; END $$;
