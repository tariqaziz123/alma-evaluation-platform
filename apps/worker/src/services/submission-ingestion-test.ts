import "dotenv/config";

import { SubmissionIngestionService } from "./submission-ingestion.service.js";
import { prisma } from "../lib/prisma.js";

const submission = await prisma.submission.findFirst({
  where: {
    artifacts: {
      some: {
        type: "GITHUB",
      },
    },
  },
});

if (!submission) {
  throw new Error(
    "No GitHub submission found. Create one through the API first.",
  );
}

console.log(`Testing ingestion: ${submission.id}`);

const service = new SubmissionIngestionService();

await service.process(submission.id);

const chunks = await prisma.evaluationChunk.findMany({
  where: {
    submissionId: submission.id,
  },
  orderBy: [
    { filePath: "asc" },
    { chunkIndex: "asc" },
  ],
  select: {
    filePath: true,
    chunkIndex: true,
    tokenEstimate: true,
  },
});

console.log("\n=== Stored Evaluation Chunks ===");

for (const chunk of chunks) {
  console.log(
    `${chunk.filePath} | chunk ${chunk.chunkIndex} | ${chunk.tokenEstimate} tokens`,
  );
}

console.log(`\nTotal chunks: ${chunks.length}`);

await prisma.$disconnect();