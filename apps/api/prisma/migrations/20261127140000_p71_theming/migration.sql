-- P71 (DS-12/9.7): white-label tenant theming — the theme contract rides the
-- design system's CSS-variable ladder (accent → --primary/--accent, ring,
-- radius, logo slot); runtime var override = zero forked components.
CREATE TABLE IF NOT EXISTS "tenant_themes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "accent" TEXT NOT NULL,
  "ring" TEXT,
  "radiusPx" INTEGER,
  "logoKey" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_themes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_themes_tenant" ON "tenant_themes"("tenantId");
