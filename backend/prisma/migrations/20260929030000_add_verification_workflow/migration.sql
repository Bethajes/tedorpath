-- AlterEnum
ALTER TYPE "ProfileStatus" ADD VALUE 'NEEDS_INFORMATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "VerificationStatus" ADD VALUE 'DOCUMENTS_REQUESTED';
ALTER TYPE "VerificationStatus" ADD VALUE 'DOCUMENTS_RECEIVED';
ALTER TYPE "VerificationStatus" ADD VALUE 'NEEDS_MORE_INFORMATION';

-- AlterTable
ALTER TABLE "tutor_profiles" ADD COLUMN     "adminMessage" VARCHAR(2000),
ADD COLUMN     "adminNotes" VARCHAR(4000),
ADD COLUMN     "applicationReference" VARCHAR(20),
ADD COLUMN     "rejectionReason" VARCHAR(100),
ADD COLUMN     "verificationChecklist" JSONB,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "tutor_profiles_applicationReference_key" ON "tutor_profiles"("applicationReference");
