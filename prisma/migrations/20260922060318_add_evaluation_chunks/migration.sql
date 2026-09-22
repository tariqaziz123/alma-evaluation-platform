-- CreateTable
CREATE TABLE "EvaluationChunk" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenEstimate" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationChunk_submissionId_idx" ON "EvaluationChunk"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationChunk_submissionId_filePath_chunkIndex_key" ON "EvaluationChunk"("submissionId", "filePath", "chunkIndex");

-- AddForeignKey
ALTER TABLE "EvaluationChunk" ADD CONSTRAINT "EvaluationChunk_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
