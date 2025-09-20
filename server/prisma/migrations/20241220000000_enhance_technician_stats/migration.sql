-- Migration: Enhance Technician Statistics
-- Add fields to support better technician performance tracking

-- Add performance tracking fields to Technician model
ALTER TABLE "technicians" ADD COLUMN "performanceScore" REAL DEFAULT 0;
ALTER TABLE "technicians" ADD COLUMN "lastPerformanceUpdate" DATETIME;
ALTER TABLE "technicians" ADD COLUMN "totalRating" REAL DEFAULT 0;
ALTER TABLE "technicians" ADD COLUMN "ratingCount" INTEGER DEFAULT 0;
ALTER TABLE "technicians" ADD COLUMN "avgCompletionTimeHours" REAL DEFAULT 0;
ALTER TABLE "technicians" ADD COLUMN "streakDays" INTEGER DEFAULT 0;
ALTER TABLE "technicians" ADD COLUMN "lastActiveDate" DATETIME;

-- Add more detailed tracking to JobTechnician
ALTER TABLE "job_technicians" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "job_technicians" ADD COLUMN "travelTimeMinutes" INTEGER DEFAULT 0;
ALTER TABLE "job_technicians" ADD COLUMN "workTimeMinutes" INTEGER DEFAULT 0;
ALTER TABLE "job_technicians" ADD COLUMN "customerSatisfaction" INTEGER; -- 1-5 rating
ALTER TABLE "job_technicians" ADD COLUMN "qualityScore" INTEGER; -- 1-10 score

-- Create TechnicianPerformanceLog for historical tracking
CREATE TABLE "technician_performance_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "technicianId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "jobsCompleted" INTEGER DEFAULT 0,
    "avgRating" REAL DEFAULT 0,
    "avgCompletionTime" REAL DEFAULT 0,
    "performanceScore" REAL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE
);

-- Create TechnicianAchievements table
CREATE TABLE "technician_achievements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "technicianId" TEXT NOT NULL,
    "achievementType" TEXT NOT NULL,
    "achievementName" TEXT NOT NULL,
    "description" TEXT,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT, -- JSON data for achievement details
    FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX "idx_technician_performance_logs_technician_date" ON "technician_performance_logs"("technicianId", "date");
CREATE INDEX "idx_technician_performance_logs_date" ON "technician_performance_logs"("date");
CREATE INDEX "idx_technician_achievements_technician" ON "technician_achievements"("technicianId");
CREATE INDEX "idx_technician_achievements_type" ON "technician_achievements"("achievementType");
