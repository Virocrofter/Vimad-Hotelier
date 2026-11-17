-- P19_onboarding_progress (additive only - hand-written, drift-safe)
ALTER TABLE "properties" ADD COLUMN "checkInTime" TEXT NOT NULL DEFAULT '14:00';
ALTER TABLE "properties" ADD COLUMN "checkOutTime" TEXT NOT NULL DEFAULT '10:00';
CREATE TABLE "OnboardingProgress" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT,
  "currentStep" TEXT NOT NULL DEFAULT 'welcome',
  "completedSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "skippedSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "answers" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OnboardingProgress_tenantId_propertyId_key" ON "OnboardingProgress"("tenantId", "propertyId");
CREATE INDEX "OnboardingProgress_tenantId_idx" ON "OnboardingProgress"("tenantId");
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
