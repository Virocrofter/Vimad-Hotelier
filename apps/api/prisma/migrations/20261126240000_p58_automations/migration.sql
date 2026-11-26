-- P58 (Phase 13): automations v1 — workflow → steps → run(trace) → storage.
CREATE TABLE IF NOT EXISTS "automation_workflows" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "triggerType" TEXT NOT NULL,
  "eventKey" TEXT,
  "cronMinutes" INTEGER,
  "propertyId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastFiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_workflows_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "automation_workflows_tenant" ON "automation_workflows"("tenantId", "isActive");

CREATE TABLE IF NOT EXISTS "automation_steps" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "parentStepId" TEXT,
  "type" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "automation_steps_workflow" ON "automation_steps"("workflowId", "sortOrder");

CREATE TABLE IF NOT EXISTS "automation_runs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "triggerPayload" JSONB,
  "executionTrace" JSONB NOT NULL DEFAULT '[]',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "resumeAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "automation_runs_workflow" ON "automation_runs"("tenantId", "workflowId", "createdAt");

CREATE TABLE IF NOT EXISTS "automation_storage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_storage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "automation_storage_tenant_key" ON "automation_storage"("tenantId", "key");
