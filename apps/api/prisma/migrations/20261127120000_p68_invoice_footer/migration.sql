-- P68: invoice bank/footer — property setting + immutable snapshot on documents.
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "invoiceFooter" TEXT;
ALTER TABLE "tax_invoices" ADD COLUMN IF NOT EXISTS "invoiceFooter" TEXT;
