-- CreateEnum
CREATE TYPE "TutorRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tutor_requests" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "email" TEXT,
    "subject" TEXT NOT NULL,
    "educationLevel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "learningMode" TEXT NOT NULL,
    "location" TEXT,
    "preferredDays" TEXT,
    "preferredTime" TEXT,
    "budget" TEXT,
    "additionalInfo" TEXT,
    "status" "TutorRequestStatus" NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutor_requests_status_idx" ON "tutor_requests"("status");

-- CreateIndex
CREATE INDEX "tutor_requests_createdAt_idx" ON "tutor_requests"("createdAt");

