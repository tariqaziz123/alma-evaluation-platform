import { ContentChunker } from "./services/content-chunker.service.js";

const content = "A".repeat(30_000);

const chunker = new ContentChunker(12_000);

const chunks = chunker.chunk(
  "src/example.ts",
  content,
);

console.log(`Chunks created: ${chunks.length}`);

for (const chunk of chunks) {
  console.log({
    index: chunk.chunkIndex,
    characters: chunk.content.length,
    estimatedTokens: chunk.estimatedTokens,
  });
}