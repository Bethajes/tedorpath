-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "TeachingMode" AS ENUM ('ONLINE', 'IN_PERSON', 'BOTH');

-- AlterTable: Add tutorProfileId to TutorRequest
ALTER TABLE "tutor_requests" ADD COLUMN "tutorProfileId" UUID;

-- CreateTable: subjects
CREATE TABLE "subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "description" VARCHAR(300),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tutor_profiles
CREATE TABLE "tutor_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "headline" VARCHAR(160) NOT NULL,
    "bio" VARCHAR(2000) NOT NULL,
    "location" VARCHAR(120),
    "profilePhotoUrl" VARCHAR(2048),
    "teachingMode" "TeachingMode" NOT NULL,
    "studentLevels" TEXT[] NOT NULL,
    "languages" TEXT[] NOT NULL DEFAULT ARRAY['English']::TEXT[],
    "availability" VARCHAR(300),
    "hourlyRate" DECIMAL(10,2),
    "experience" VARCHAR(2000),
    "education" VARCHAR(2000),
    "profileStatus" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tutor_profile_subjects
CREATE TABLE "tutor_profile_subjects" (
    "tutorProfileId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,

    CONSTRAINT "tutor_profile_subjects_pkey" PRIMARY KEY ("tutorProfileId","subjectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");
CREATE UNIQUE INDEX "tutor_profiles_userId_key" ON "tutor_profiles"("userId");
CREATE INDEX "tutor_profiles_profileStatus_idx" ON "tutor_profiles"("profileStatus");
CREATE INDEX "tutor_profiles_createdAt_idx" ON "tutor_profiles"("createdAt");

-- AddForeignKey: tutor_profiles.userId -> users.id
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tutor_profile_subjects.tutorProfileId -> tutor_profiles.id
ALTER TABLE "tutor_profile_subjects" ADD CONSTRAINT "tutor_profile_subjects_tutorProfileId_fkey"
    FOREIGN KEY ("tutorProfileId") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tutor_profile_subjects.subjectId -> subjects.id
ALTER TABLE "tutor_profile_subjects" ADD CONSTRAINT "tutor_profile_subjects_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: tutor_requests.tutorProfileId -> tutor_profiles.id
ALTER TABLE "tutor_requests" ADD CONSTRAINT "tutor_requests_tutorProfileId_fkey"
    FOREIGN KEY ("tutorProfileId") REFERENCES "tutor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
