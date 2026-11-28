-- Phase 2 (2026-11-28): SARS-compliant SaaS invoicing.
-- Sequential per-year invoice numbers (SARS requirement), atomically claimed
-- inside the invoice transaction via upsert RETURNING.

CREATE TABLE IF NOT EXISTS "saas_invoice_seq" (
  "year" INTEGER PRIMARY KEY,
  "seq" INTEGER NOT NULL DEFAULT 0
);
