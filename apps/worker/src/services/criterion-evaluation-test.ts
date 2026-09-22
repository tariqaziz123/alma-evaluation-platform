import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { CriterionEvaluationService } from "./criterion-evaluation.service.js";

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

const service = new CriterionEvaluationService();

const result = await service.evaluate(
  submission.id,
  {
    name: criterion.name,
    description: criterion.description ?? undefined,
  },
  {
    projectName: "README",
    languages: [],
    frameworks: [],
    dependencies: [],
    scripts: [],
    hasReadme: true,
    hasTests: false,
    hasDocker: false,
    importantFiles: ["README"],
  },
);

console.log("\n=== Criterion Evaluation ===");
console.log(JSON.stringify(result, null, 2));

await prisma.$disconnect();