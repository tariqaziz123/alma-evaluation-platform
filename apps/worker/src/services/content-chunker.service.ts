export type ContentChunk = {
  filePath: string;
  chunkIndex: number;
  content: string;
  estimatedTokens: number;
};

const DEFAULT_CHUNK_SIZE = 12000;

export class ContentChunker {
  constructor(
    private readonly chunkSize = DEFAULT_CHUNK_SIZE,
  ) {}

  chunk(filePath: string, content: string): ContentChunk[] {
    if (!content.trim()) {
      return [];
    }

    const chunks: ContentChunk[] = [];

    for (
      let start = 0, chunkIndex = 0;
      start < content.length;
      start += this.chunkSize, chunkIndex++
    ) {
      const chunk = content.slice(start, start + this.chunkSize);

      chunks.push({
        filePath,
        chunkIndex,
        content: chunk,
        estimatedTokens: this.estimateTokens(chunk),
      });
    }

    return chunks;
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }
}