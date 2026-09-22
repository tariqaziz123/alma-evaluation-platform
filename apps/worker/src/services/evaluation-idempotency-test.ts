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
  throw new Error("No rubric found");
}

const orchestrator = new EvaluationOrchestrator();

console.log("First evaluation...");
await orchestrator.evaluateForSubmission(submission.id);

console.log("\nSecond evaluation...");
await orchestrator.evaluateForSubmission(submission.id);

const jobs = await prisma.evaluationJob.findMany({
  where: {
    submissionId: submission.id,
    rubricId: rubric.id,
  },
  orderBy: {
    createdAt: "asc",
  },
});

console.log("\n=== IDEMPOTENCY RESULT ===");

console.log({
  submissionId: submission.id,
  evaluationJobCount: jobs.length,
  jobIds: jobs.map((job) => job.id),
  statuses: jobs.map((job) => job.status),
});

await prisma.$disconnect();