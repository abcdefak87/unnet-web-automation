-- Add PSB specific fields to Job table
ALTER TABLE "jobs" ADD COLUMN "installationDescription" TEXT;
ALTER TABLE "jobs" ADD COLUMN "packageType" TEXT;
ALTER TABLE "jobs" ADD COLUMN "installationType" TEXT;
