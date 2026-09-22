import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { RubricRetrievalService } from "./rubric-retrieval.service.js";

const submission = await prisma.submission.findFirst({
  where: {
    evaluationChunks: {
      some: {},
    },
  },
});

if (!submission) {
  throw new Error(
    "No submission with evaluation chunks found.",
  );
}

const criterion = await prisma.rubricCriterion.findFirst({
  where: {
    name: {
      contains: "Documentation",
      mode: "insensitive",
    },
  },
});

if (!criterion) {
  throw new Error("Documentation criterion not found.");
}

const service = new RubricRetrievalService();

const results = await service.retrieve(
  submission.id,
  {
    name: criterion.name,
    description: criterion.description ?? undefined,
  },
  5,
);

console.log("\n=== Rubric Retrieval ===");
console.log(`Criterion: ${criterion.name}`);
console.log(`Results: ${results.length}`);

for (const result of results) {
  console.log(`\nFile: ${result.filePath}`);
  console.log(`Similarity: ${result.similarity.toFixed(4)}`);
  console.log(`Evidence: ${result.content}`);
}

await prisma.$disconnect();