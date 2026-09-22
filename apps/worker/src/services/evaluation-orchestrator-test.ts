import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { EvaluationOrchestrator } from "./evaluation-orchestrator.service.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const submission = await prisma.submission.findFirst({
  where: {
    artifacts: {
      some: {
        type: "GITHUB",
        sourceUrl: {
          not: null,
        },
      },
    },
  },
  include: {
    assignment: {
      include: {
        rubrics: {
          orderBy: {
            version: "desc",
          },
          take: 1,
          include: {
            criteria: true,
          },
        },
      },
    },
  },
});

if (!submission) {
  throw new Error("No GitHub submission found");
}

const rubric = submission.assignment.rubrics[0];

if (!rubric) {
  throw new Error("No rubric found for submission assignment");
}

const evaluationJob = await prisma.evaluationJob.create({
  data: {
    submissionId: submission.id,
    rubricId: rubric.id,
    evaluationKey: `rubric:${rubric.id}:test-${Date.now()}`,
    status: "PENDING",
  },
});

console.log("Created evaluation job:", evaluationJob.id);

const orchestrator = new EvaluationOrchestrator();

try {
  await orchestrator.evaluate(evaluationJob.id);

  const result = await prisma.evaluationResult.findUnique({
    where: {
      evaluationJobId: evaluationJob.id,
    },
    include: {
      criteria: true,
    },
  });

  const finalJob = await prisma.evaluationJob.findUnique({
    where: {
      id: evaluationJob.id,
    },
  });

  console.log("\n=== FINAL EVALUATION ===");

  console.log({
    jobId: evaluationJob.id,
    status: finalJob?.status,
    totalScore: result?.totalScore,
    maxScore: result?.maxScore,
    criteriaCount: result?.criteria.length,
  });

  console.log("\n=== CRITERIA ===");

  for (const criterion of result?.criteria ?? []) {
    console.log({
      score: criterion.score,
      maxScore: criterion.maxScore,
      confidence: criterion.confidence,
    });
  }
} finally {
  await prisma.$disconnect();
}