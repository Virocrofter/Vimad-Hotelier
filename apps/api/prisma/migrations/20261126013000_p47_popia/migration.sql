-- P47: POPIA arc — ID-scan purge marker + security incident ledger.
ALTER TABLE "reservation_documents" ADD COLUMN IF NOT EXISTS "purgedAt" TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS "security_incidents" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolution" TEXT,
  "reportedById" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "officerNotified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_incidents_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "security_incidents_tenant_status" ON "security_incidents"("tenantId", "status");
