CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "EvaluationChunk" ADD COLUMN "embedding" vector(1536);