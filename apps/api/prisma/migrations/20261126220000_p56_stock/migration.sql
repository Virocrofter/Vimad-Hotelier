-- P56 (F6): stock ledger, recipes/BOM. Current qty is DERIVED from the
-- movement ledger — no cached counters, no drift.
CREATE TABLE IF NOT EXISTS "stock_items" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'ea',
  "parLevel" DECIMAL(10,2),
  "costPerUnit" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stock_items_property" ON "stock_items"("tenantId", "propertyId");

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "quantityDelta" DECIMAL(10,3) NOT NULL,
  "unitCost" DECIMAL(10,2),
  "note" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stock_movements_item" ON "stock_movements"("tenantId", "stockItemId", "createdAt");

CREATE TABLE IF NOT EXISTS "recipes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recipes_product" ON "recipes"("tenantId", "productId");

CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
  "id" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recipe_ingredients_recipe" ON "recipe_ingredients"("recipeId");
