/*
  Warnings:

  - Made the column `payload` on table `webhook_dispatches` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "reservations_agentAccount";

-- DropIndex
DROP INDEX "users_agentAccount";

-- AlterTable
ALTER TABLE "webhook_dispatches" ALTER COLUMN "payload" SET NOT NULL;

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "propertyName" TEXT,
    "roomCount" INTEGER,
    "currentPms" TEXT,
    "message" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'new',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "page" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_status_createdAt_idx" ON "leads"("status", "createdAt");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- RenameForeignKey
ALTER TABLE "gift_vouchers" RENAME CONSTRAINT "gift_vouchers_tenant_fkey" TO "gift_vouchers_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "integration_installations" RENAME CONSTRAINT "integration_installations_tenant_fkey" TO "integration_installations_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "payment_proofs" RENAME CONSTRAINT "payment_proofs_tenant_fkey" TO "payment_proofs_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "reservations" RENAME CONSTRAINT "reservations_agentAccount_fkey" TO "reservations_agentAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "security_incidents" RENAME CONSTRAINT "security_incidents_tenant_fkey" TO "security_incidents_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "users" RENAME CONSTRAINT "users_agentAccount_fkey" TO "users_agentAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "webhook_dispatches" RENAME CONSTRAINT "webhook_dispatches_endpoint_fkey" TO "webhook_dispatches_endpointId_fkey";

-- RenameForeignKey
ALTER TABLE "webhook_endpoints" RENAME CONSTRAINT "webhook_endpoints_tenant_fkey" TO "webhook_endpoints_tenantId_fkey";

-- RenameIndex
ALTER INDEX "automation_runs_workflow" RENAME TO "automation_runs_tenantId_workflowId_createdAt_idx";

-- RenameIndex
ALTER INDEX "automation_steps_workflow" RENAME TO "automation_steps_workflowId_sortOrder_idx";

-- RenameIndex
ALTER INDEX "automation_storage_tenant_key" RENAME TO "automation_storage_tenantId_key_key";

-- RenameIndex
ALTER INDEX "automation_workflows_tenant" RENAME TO "automation_workflows_tenantId_isActive_idx";

-- RenameIndex
ALTER INDEX "chain_templates_chain" RENAME TO "chain_templates_tenantId_chainId_idx";

-- RenameIndex
ALTER INDEX "fnb_orders_tenant_status" RENAME TO "fnb_orders_tenantId_propertyId_status_idx";

-- RenameIndex
ALTER INDEX "fnb_tables_property" RENAME TO "fnb_tables_tenantId_propertyId_status_idx";

-- RenameIndex
ALTER INDEX "gift_vouchers_tenant_code" RENAME TO "gift_vouchers_tenantId_code_key";

-- RenameIndex
ALTER INDEX "gift_vouchers_tenant_status" RENAME TO "gift_vouchers_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "integration_installations_tenant_key" RENAME TO "integration_installations_tenantId_catalogKey_idx";

-- RenameIndex
ALTER INDEX "integration_installations_tenant_status" RENAME TO "integration_installations_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "payment_proofs_tenant_reservation" RENAME TO "payment_proofs_tenantId_reservationId_idx";

-- RenameIndex
ALTER INDEX "payment_proofs_tenant_status" RENAME TO "payment_proofs_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "preauths_reservation" RENAME TO "preauths_tenantId_reservationId_status_idx";

-- RenameIndex
ALTER INDEX "recipe_ingredients_recipe" RENAME TO "recipe_ingredients_recipeId_idx";

-- RenameIndex
ALTER INDEX "recipes_product" RENAME TO "recipes_tenantId_productId_idx";

-- RenameIndex
ALTER INDEX "security_incidents_tenant_status" RENAME TO "security_incidents_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "stock_items_property" RENAME TO "stock_items_tenantId_propertyId_idx";

-- RenameIndex
ALTER INDEX "stock_movements_item" RENAME TO "stock_movements_tenantId_stockItemId_createdAt_idx";

-- RenameIndex
ALTER INDEX "stock_transfers_tenant" RENAME TO "stock_transfers_tenantId_createdAt_idx";

-- RenameIndex
ALTER INDEX "tenant_themes_tenant" RENAME TO "tenant_themes_tenantId_key";

-- RenameIndex
ALTER INDEX "till_items_check" RENAME TO "till_check_items_checkId_idx";

-- RenameIndex
ALTER INDEX "till_checks_tenant_status" RENAME TO "till_checks_tenantId_propertyId_status_idx";

-- RenameIndex
ALTER INDEX "till_payments_check" RENAME TO "till_payments_checkId_idx";

-- RenameIndex
ALTER INDEX "till_sessions_property" RENAME TO "till_sessions_tenantId_propertyId_status_idx";

-- RenameIndex
ALTER INDEX "webhook_dispatches_status_next" RENAME TO "webhook_dispatches_status_nextRetryAt_idx";

-- RenameIndex
ALTER INDEX "webhook_dispatches_tenant_created" RENAME TO "webhook_dispatches_tenantId_createdAt_idx";

-- RenameIndex
ALTER INDEX "webhook_endpoints_tenant_status" RENAME TO "webhook_endpoints_tenantId_status_idx";
