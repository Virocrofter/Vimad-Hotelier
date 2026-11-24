-- P38 (D1+): developer webhook endpoints. (Dispatch rows live in
-- webhook_dispatches — the channel layer owns webhook_deliveries.)
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "events" TEXT[],
  "secret" TEXT NOT NULL,
  "previousSecret" TEXT,
  "previousExpiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "webhook_endpoints_tenant_status" ON "webhook_endpoints"("tenantId", "status");
