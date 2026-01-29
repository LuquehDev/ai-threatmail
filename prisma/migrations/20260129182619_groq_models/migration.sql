/*
  Warnings:

  - You are about to drop the column `aiProvider` on the `UserSettings` table. All the data in the column will be lost.
  - You are about to drop the `Account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `content` on table `AnalysisFile` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "GroqModel" AS ENUM ('LLAMA_70B', 'LLAMA_8B');

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- AlterTable
ALTER TABLE "AnalysisFile" ADD COLUMN     "scanResult" JSONB,
ALTER COLUMN "content" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "aiProvider",
ADD COLUMN     "groqModel" "GroqModel" NOT NULL DEFAULT 'LLAMA_70B';

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "VerificationToken";

-- CreateIndex
CREATE INDEX "AnalysisFile_sha256_idx" ON "AnalysisFile"("sha256");
