-- P42: SA compliance profile fields on properties.
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "tgcsaGrade" TEXT;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "tgcsaCertificateExpiry" DATE;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "liquorLicenceExpiry" DATE;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "popiaInformationOfficerName" TEXT;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "popiaInformationOfficerEmail" TEXT;
