-- Phase 2 (2026-11-28): plan catalog moves to DB (kills 3 constant forks).
-- ZAR major units (invoices are major-unit Rand per money UX standard).
-- perRoomZar/includedRooms are seeded hypotheses from the v3 pricing doc
-- (Vimad-Billing-Architecture-v3.pdf) - govern weekly, edit via
-- PUT /admin/billing/plans/:code or the admin Plans page.

CREATE TABLE IF NOT EXISTS "plan_catalog" (
  "code" TEXT PRIMARY KEY,
  "label" TEXT NOT NULL,
  "bandMinZar" INTEGER NOT NULL DEFAULT 0,
  "bandMaxZar" INTEGER,
  "monthlyZar" INTEGER NOT NULL DEFAULT 0,
  "perRoomZar" INTEGER NOT NULL DEFAULT 0,
  "includedRooms" INTEGER NOT NULL DEFAULT 0,
  "includedFeatures" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "overageRates" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "usageLimits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO "plan_catalog"
  ("code","label","bandMinZar","bandMaxZar","monthlyZar","perRoomZar","includedRooms","includedFeatures","overageRates","usageLimits","isActive","sortOrder")
VALUES
  ('trial','Beacon Trial',0,0,0,0,0,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,true,0),
  ('starter','Compass',1499,2499,1499,50,6,
    '["timeline","reservations","direct_booking","channel_catch","housekeeping_board","paystack_links","sars_vat_reports","csv_importer"]'::jsonb,
    '{"perThousandApiCalls":0.5,"perGbStorage":5.0,"perSms":0.05,"perExtraProperty":49}'::jsonb,
    '{"apiCalls":10000,"storageGb":1,"sms":100,"includedProperties":1}'::jsonb,true,1),
  ('professional','Command',3499,5999,3499,60,20,
    '["compass","folios_split_city_ledger","derived_rates","hk_supervisor","maintenance_tickets","guest_portal_checkin","prearrival_upsells","omnichannel_inbox","xero_sage_export"]'::jsonb,
    '{"perThousandApiCalls":0.3,"perGbStorage":3.0,"perSms":0.03,"perExtraProperty":29}'::jsonb,
    '{"apiCalls":100000,"storageGb":10,"sms":1000,"includedProperties":3}'::jsonb,true,2),
  ('enterprise','Constellation',6999,11999,6999,70,80,
    '["command","needs_attention_v2","bi_rollups","advanced_automations","corporate_invoicing","priority_support"]'::jsonb,
    '{"perThousandApiCalls":0.15,"perGbStorage":1.5,"perSms":0.02,"perExtraProperty":19}'::jsonb,
    '{"apiCalls":1000000,"storageGb":100,"sms":10000,"includedProperties":10}'::jsonb,true,3),
  ('armada','Armada',7500,NULL,7500,70,0,
    '["constellation","portfolio_switcher","chain_shared_profiles","cross_property_booking","enterprise_rbac","open_webhooks_api"]'::jsonb,
    '{"perThousandApiCalls":0.15,"perGbStorage":1.5,"perSms":0.02,"perExtraProperty":19}'::jsonb,
    '{"apiCalls":1000000,"storageGb":100,"sms":10000,"includedProperties":10}'::jsonb,true,4)
ON CONFLICT ("code") DO NOTHING;
