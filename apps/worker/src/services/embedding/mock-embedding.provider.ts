import type { EmbeddingProvider } from "../../../../../packages/shared/src/evaluation/embedding.js";

const EMBEDDING_DIMENSIONS = 1536;

export class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    return this.generateEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateEmbedding(text));
  }

  private generateEmbedding(text: string): number[] {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);

    for (let i = 0; i < text.length; i++) {
      const index = i % EMBEDDING_DIMENSIONS;
      vector[index] += text.charCodeAt(i) / 255;
    }

    const magnitude = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );

    if (magnitude === 0) {
      return vector;
    }

    return vector.map((value) => value / magnitude);
  }
}