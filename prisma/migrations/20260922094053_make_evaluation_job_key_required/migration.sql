/*
  Warnings:

  - Made the column `evaluationKey` on table `EvaluationJob` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "EvaluationJob" ALTER COLUMN "evaluationKey" SET NOT NULL;
