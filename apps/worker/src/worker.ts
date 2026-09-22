import { RedisQueue } from "../../../packages/shared/src/queue/redis-queue.js";
import type { SubmissionProcessingJob } from "../../../packages/shared/src/queue/types.js";
import { prisma } from "./lib/prisma.js";
import { EvaluationOrchestrator } from "./services/evaluation-orchestrator.service.js";

const queue = new RedisQueue(
  process.env.REDIS_URL ?? "redis://localhost:6379",
);

const orchestrator = new EvaluationOrchestrator();

async function processSubmission(
  job: SubmissionProcessingJob,
): Promise<void> {
  console.log(
    `[Worker] Processing ${job.type} job: ${job.jobId}`,
  );

  const submission = await prisma.submission.findUnique({
    where: {
      id: job.submissionId,
    },
    include: {
      artifacts: true,
    },
  });

  if (!submission) {
    throw new Error(
      `Submission not found: ${job.submissionId}`,
    );
  }

  try {
    if (job.type === "INGESTION") {
      await prisma.submission.update({
        where: {
          id: submission.id,
        },
        data: {
          status: "PROCESSING",
        },
      });

      console.log(
        `[Worker] Ingesting submission ${submission.id}`,
      );

      await orchestrator.ingestSubmission(
        submission.id,
      );

      console.log(
        `[Worker] Ingestion completed for ${submission.id}`,
      );

      return;
    }

    if (job.type === "EVALUATION") {
  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: "EVALUATING" },
  });

  console.log(`[Worker] Evaluating submission ${submission.id}`);

  if (!job.evaluationJobId) {
    throw new Error(
      `Evaluation job ID is required for evaluation job ${job.jobId}`,
    );
  }

  const previousAttempt = await prisma.evaluationAttempt.findFirst({
    where: {
      evaluationJobId: job.evaluationJobId,
    },
    orderBy: {
      attemptNumber: "desc",
    },
  });

  const attemptNumber = (previousAttempt?.attemptNumber ?? 0) + 1;

  const attempt = await prisma.evaluationAttempt.create({
    data: {
      evaluationJobId: job.evaluationJobId,
      attemptNumber,
      status: "RUNNING",
      workerId: process.env.WORKER_ID ?? "local-worker",
    },
  });

  try {
    await orchestrator.evaluate(job.evaluationJobId);

    await prisma.evaluationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
      },
    });

    console.log(
      `[Worker] Evaluation completed for ${submission.id} (attempt ${attemptNumber})`,
    );

    return;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown evaluation error";

    await prisma.evaluationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "FAILED",
        errorCode: "EVALUATION_FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

    throw new Error(
      `Unsupported job type: ${job.type}`,
    );
  } catch (error) {
    console.error(
      `[Worker] ${job.type} job failed for submission ${submission.id}`,
      error,
    );

    await prisma.submission.update({
      where: {
        id: submission.id,
      },
      data: {
        status: "FAILED",
      },
    });

    throw error;
  }
}

async function main(): Promise<void> {
  console.log("Evaluation worker started");

  await queue.consume(processSubmission);
}

main().catch((error) => {
  console.error("Worker failed:", error);
  process.exitCode = 1;
});