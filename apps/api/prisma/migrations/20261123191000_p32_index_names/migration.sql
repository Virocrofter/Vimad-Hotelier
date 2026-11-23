-- P32 follow-up: index names to Prisma's convention (zero-drift; names only).
ALTER INDEX IF EXISTS "lost_found_items_tenant_property" RENAME TO "lost_found_items_tenantId_propertyId_idx";
ALTER INDEX IF EXISTS "lost_found_items_tenant_status" RENAME TO "lost_found_items_tenantId_status_idx";
