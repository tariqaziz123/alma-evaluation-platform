import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { MockEmbeddingProvider } from "./embedding/mock-embedding.provider.js";
import { VectorStoreService } from "./vector-store.service.js";

const embeddingProvider = new MockEmbeddingProvider();
const vectorStore = new VectorStoreService();

const submission = await prisma.submission.findFirst();

if (!submission) {
  throw new Error("No submission found. Run the seed script first.");
}

const chunks = [
  {
    filePath: "src/services/payment.service.ts",
    content:
      "Payment service handles payment processing and transaction validation.",
  },
  {
    filePath: "src/components/Button.tsx",
    content:
      "Reusable React button component with loading and disabled states.",
  },
  {
    filePath: "src/architecture/router.ts",
    content:
      "Application routing and service boundaries define the frontend architecture.",
  },
];

for (let index = 0; index < chunks.length; index++) {
  const chunk = chunks[index];

  const created = await prisma.evaluationChunk.upsert({
    where: {
      submissionId_filePath_chunkIndex: {
        submissionId: submission.id,
        filePath: chunk.filePath,
        chunkIndex: index,
      },
    },
    update: {
      content: chunk.content,
      tokenEstimate: Math.ceil(chunk.content.length / 4),
    },
    create: {
      submissionId: submission.id,
      filePath: chunk.filePath,
      chunkIndex: index,
      content: chunk.content,
      tokenEstimate: Math.ceil(chunk.content.length / 4),
    },
  });

  const embedding = await embeddingProvider.embed(chunk.content);

  await vectorStore.saveEmbedding(created.id, embedding);
}

const query = await embeddingProvider.embed(
  "How is the application architecture structured?",
);

const results = await vectorStore.searchSimilar(
  submission.id,
  query,
  3,
);

console.log("\n=== Similar Chunks ===");

for (const result of results) {
  console.log(`\nFile: ${result.filePath}`);
  console.log(`Similarity: ${result.similarity.toFixed(4)}`);
  console.log(`Content: ${result.content}`);
}

await prisma.$disconnect();