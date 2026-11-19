-- P21: shift logbook — hand-authored (migrate dev banned on this repo).
CREATE TABLE "logbook_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "message" TEXT NOT NULL,
    "shift" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logbook_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "logbook_entries_tenantId_propertyId_createdAt_idx" ON "logbook_entries"("tenantId", "propertyId", "createdAt");

ALTER TABLE "logbook_entries" ADD CONSTRAINT "logbook_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "logbook_entries" ADD CONSTRAINT "logbook_entries_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
