
import { RedisQueue } from "../../../packages/shared/src/queue/redis-queue.js";
import type {
  SubmissionProcessingJob,
} from "../../../packages/shared/src/queue/types.js";
import { prisma } from "./lib/prisma.js";

const queue = new RedisQueue(
  process.env.REDIS_URL ?? "redis://localhost:6379",
);

async function processSubmission(
  job: SubmissionProcessingJob,
): Promise<void> {
  console.log(`[Worker] Processing job: ${job.jobId}`);

  const submission = await prisma.submission.findUnique({
    where: {
      id: job.submissionId,
    },
    include: {
      artifacts: true,
    },
  });

  if (!submission) {
    throw new Error(`Submission not found: ${job.submissionId}`);
  }

  await prisma.submission.update({
    where: {
      id: submission.id,
    },
    data: {
      status: "PROCESSING",
    },
  });

  console.log(
    `[Worker] Submission ${submission.id} is now PROCESSING`,
  );

  // Temporary processing simulation.
  // Real artifact extraction will be added later.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await prisma.submission.update({
    where: {
      id: submission.id,
    },
    data: {
      status: "COMPLETED",
    },
  });

  console.log(
    `[Worker] Submission ${submission.id} completed`,
  );
}

async function main() {
  console.log("Evaluation worker started");

  await queue.consume(processSubmission);
}

main()
  .catch((error) => {
    console.error("Worker failed:", error);
    process.exitCode = 1;
  });