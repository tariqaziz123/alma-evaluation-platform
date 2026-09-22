import "dotenv/config";
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { EvaluationPersistenceService } from "./evaluation-persistence.service.js";

const submission = await prisma.submission.findFirst();

if (!submission) {
  throw new Error("No submission found.");
}

const rubric = await prisma.rubric.findFirst({
  where: {
    assignmentId: submission.assignmentId,
  },
  include: {
    criteria: true,
  },
});

if (!rubric) {
  throw new Error("No rubric found for submission.");
}

const job = await prisma.evaluationJob.create({
  data: {
    id: randomUUID(),
    submissionId: submission.id,
    rubricId: rubric.id,
    status: "PROCESSING",
  },
});

const evaluation = {
  summary: "Development persistence test.",
  criteria: rubric.criteria.map((criterion, index) => ({
    criterion: criterion.name,
    score: Math.min(index + 1, Number(criterion.maxScore)),
    maxScore: Number(criterion.maxScore),
    confidence: 0.8,
    evidence: [
      {
        file: "README",
        explanation: "Test evidence for persistence.",
      },
    ],
    issues: [],
  })),
};

const service = new EvaluationPersistenceService();

await service.save(job.id, evaluation);

const saved = await prisma.evaluationResult.findUnique({
  where: {
    evaluationJobId: job.id,
  },
  include: {
    criteria: true,
  },
});

console.log("\n=== Persisted Evaluation ===");
console.log(`Total score: ${saved?.totalScore}`);
console.log(`Max score: ${saved?.maxScore}`);
console.log(`Criteria saved: ${saved?.criteria.length}`);

console.log(
  `Job status: ${
    (
      await prisma.evaluationJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      })
    )?.status
  }`,
);

await prisma.$disconnect();