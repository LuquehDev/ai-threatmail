/*
  Warnings:

  - Added the required column `emailBody` to the `Analysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `emailSubject` to the `Analysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `emailTitle` to the `Analysis` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'SCANNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "emailBody" TEXT NOT NULL,
ADD COLUMN     "emailSubject" TEXT NOT NULL,
ADD COLUMN     "emailTitle" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "AnalysisFile" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BYTEA,
    "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisFile_analysisId_idx" ON "AnalysisFile"("analysisId");

-- AddForeignKey
ALTER TABLE "AnalysisFile" ADD CONSTRAINT "AnalysisFile_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
