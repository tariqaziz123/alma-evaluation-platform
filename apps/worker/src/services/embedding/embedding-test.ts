import { MockEmbeddingProvider } from "./mock-embedding.provider.js";

const provider = new MockEmbeddingProvider();

const embedding = await provider.embed(
  "This project uses React and TypeScript.",
);

console.log("Embedding dimensions:", embedding.length);
console.log("First 5 values:", embedding.slice(0, 5));

const batch = await provider.embedBatch([
  "React frontend",
  "PostgreSQL database",
  "AWS architecture",
]);

console.log("Batch size:", batch.length);
console.log("Each vector dimensions:", batch.map((item) => item.length));