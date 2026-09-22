import type { RubricCriterion } from "./rubric-context.service.js";
import { MockEmbeddingProvider } from "./embedding/mock-embedding.provider.js";
import { VectorStoreService } from "./vector-store.service.js";

export type RetrievedEvidence = {
  filePath: string;
  content: string;
  similarity: number;
};

export class RubricRetrievalService {
  private readonly embeddingProvider: MockEmbeddingProvider;
  private readonly vectorStore: VectorStoreService;

  constructor() {
    this.embeddingProvider = new MockEmbeddingProvider();
    this.vectorStore = new VectorStoreService();
  }

  async retrieve(
    submissionId: string,
    criterion: RubricCriterion,
    limit = 5,
  ): Promise<RetrievedEvidence[]> {
    const query = [
      `Evaluate the project for rubric criterion: ${criterion.name}.`,
      criterion.description
        ? `Criterion description: ${criterion.description}`
        : "",
      "Find evidence in the student's project that is relevant to this criterion.",
    ]
      .filter(Boolean)
      .join("\n");

    const queryEmbedding =
      await this.embeddingProvider.embed(query);

    const results = await this.vectorStore.searchSimilar(
      submissionId,
      queryEmbedding,
      limit,
    );

    return results.map((result) => ({
      filePath: result.filePath,
      content: result.content,
      similarity: result.similarity,
    }));
  }
}