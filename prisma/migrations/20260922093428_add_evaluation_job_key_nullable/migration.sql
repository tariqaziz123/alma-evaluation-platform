/*
  Warnings:

  - A unique constraint covering the columns `[submissionId,evaluationKey]` on the table `EvaluationJob` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "EvaluationJob_submissionId_idempotencyKey_key";

-- AlterTable
ALTER TABLE "EvaluationJob" ADD COLUMN     "evaluationKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationJob_submissionId_evaluationKey_key" ON "EvaluationJob"("submissionId", "evaluationKey");
