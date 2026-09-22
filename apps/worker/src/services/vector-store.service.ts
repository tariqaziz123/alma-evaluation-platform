import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type VectorSearchResult = {
  id: string;
  submissionId: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  similarity: number;
};

export class VectorStoreService {
  async saveEmbedding(
    chunkId: string,
    embedding: number[],
  ): Promise<void> {
    const vector = `[${embedding.join(",")}]`;

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "EvaluationChunk"
        SET "embedding" = ${vector}::vector
        WHERE "id" = ${chunkId}
      `,
    );
  }

  async searchSimilar(
    submissionId: string,
    queryEmbedding: number[],
    limit = 5,
  ): Promise<VectorSearchResult[]> {
    const vector = `[${queryEmbedding.join(",")}]`;

    return prisma.$queryRaw<VectorSearchResult[]>(
      Prisma.sql`
        SELECT
          "id",
          "submissionId",
          "filePath",
          "chunkIndex",
          "content",
          1 - ("embedding" <=> ${vector}::vector) AS "similarity"
        FROM "EvaluationChunk"
        WHERE "submissionId" = ${submissionId}
          AND "embedding" IS NOT NULL
        ORDER BY "embedding" <=> ${vector}::vector
        LIMIT ${limit}
      `,
    );
  }
}