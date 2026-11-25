-- P39 (D2): tenant integration installations (marketplace connect lifecycle).
CREATE TABLE IF NOT EXISTS "integration_installations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "catalogKey" TEXT NOT NULL,
  "displayName" TEXT,
  "credentials" JSONB,
  "config" JSONB,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastSyncError" TEXT,
  "connectedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_installations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "integration_installations" ADD CONSTRAINT "integration_installations_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "integration_installations_tenant_status" ON "integration_installations"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "integration_installations_tenant_key" ON "integration_installations"("tenantId", "catalogKey");
