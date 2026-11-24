-- P38 follow-up: platform webhook dispatches under their own table (the
-- channel layer owns webhook_deliveries), plus cleanup of stray indexes the
-- first P38 migration may have created on the channel table.
DROP INDEX IF EXISTS "webhook_deliveries_tenant_created";
DROP INDEX IF EXISTS "webhook_deliveries_status_next";
CREATE TABLE IF NOT EXISTS "webhook_dispatches" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "statusCode" INTEGER,
  "durationMs" INTEGER,
  "nextRetryAt" TIMESTAMP(3),
  "lastError" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "webhook_dispatches_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "webhook_dispatches" ADD CONSTRAINT "webhook_dispatches_endpoint_fkey" FOREIGN KEY ("endpointId") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "webhook_dispatches_tenant_created" ON "webhook_dispatches"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "webhook_dispatches_status_next" ON "webhook_dispatches"("status", "nextRetryAt");
