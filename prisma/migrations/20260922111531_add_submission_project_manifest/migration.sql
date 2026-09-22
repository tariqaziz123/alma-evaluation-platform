-- DropIndex
DROP INDEX "evaluation_chunk_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "projectManifest" JSONB;
