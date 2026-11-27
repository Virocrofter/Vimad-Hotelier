-- P69 (11.2): chain templates — rate/policy/message payloads pushed per property.
CREATE TABLE IF NOT EXISTS "chain_templates" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "chainId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chain_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chain_templates_chain" ON "chain_templates"("tenantId", "chainId");
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "imageKey" TEXT;
