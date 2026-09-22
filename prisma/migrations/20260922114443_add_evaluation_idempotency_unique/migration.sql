/*
  Warnings:

  - A unique constraint covering the columns `[submissionId,idempotencyKey]` on the table `EvaluationJob` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "EvaluationJob_submissionId_idempotencyKey_key" ON "EvaluationJob"("submissionId", "idempotencyKey");
