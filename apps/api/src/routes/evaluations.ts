import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { RedisQueue } from "../../../../packages/shared/src/queue/redis-queue.js";
import type { SubmissionProcessingJob } from "../../../../packages/shared/src/queue/types.js";

const router = Router();
const queue = new RedisQueue(
    process.env.REDIS_URL ?? "redis://localhost:6379",
);

function isUuid(value: unknown): value is string {
    return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value,
        )
    );
}

/**
 * Create an evaluation job.
 *
 * The evaluation itself is intentionally NOT executed inside
 * the HTTP request. The API creates the durable job and returns
 * immediately; a worker processes it asynchronously.
 */
router.post("/", async (req, res) => {
    try {
        const { submissionId, rubricId } = req.body;
        const idempotencyKeyHeader = req.header("Idempotency-Key");
        const idempotencyKey = idempotencyKeyHeader?.trim();

        if (idempotencyKey && idempotencyKey.length > 128) {
            return res.status(400).json({
                error: "Idempotency-Key must be 128 characters or fewer",
            });
        }

        if (!isUuid(submissionId) || !isUuid(rubricId)) {
            return res.status(400).json({
                error: "submissionId and rubricId must be valid UUIDs",
            });
        }

        const [submission, rubric] = await Promise.all([
            prisma.submission.findUnique({
                where: { id: submissionId },
                include: {
                    artifacts: true,
                },
            }),
            prisma.rubric.findUnique({
                where: { id: rubricId },
            }),
        ]);

        if (!submission) {
            return res.status(404).json({
                error: "Submission not found",
            });
        }

        if (!rubric) {
            return res.status(404).json({
                error: "Rubric not found",
            });
        }

        if (submission.assignmentId !== rubric.assignmentId) {
            return res.status(400).json({
                error: "Submission and rubric belong to different assignments",
            });
        }

        if (submission.status !== "UPLOADED" || !submission.projectManifest) {
            return res.status(409).json({
                error: "Submission is not ready for evaluation",
                message:
                    "The submission is still being processed. Please start evaluation after ingestion is complete.",
                status: submission.status,
            });
        }

        const artifact = submission.artifacts[0];

        if (!artifact) {
            return res.status(400).json({
                error: "Submission has no artifact",
            });
        }

        const evaluationKey = `rubric:${rubric.id}`;

        let job = idempotencyKey
            ? await prisma.evaluationJob.findUnique({
                where: {
                    submissionId_idempotencyKey: {
                        submissionId,
                        idempotencyKey,
                    },
                },
            })
            : null;

        // If the idempotency key was previously used, it must represent
        // the same evaluation request.
        if (job && job.rubricId !== rubric.id) {
            return res.status(409).json({
                error: "Idempotency-Key was already used for a different rubric",
            });
        }

        // If there is no idempotency-key match, fall back to the
        // semantic uniqueness of submission + rubric.
        if (!job) {
            job = await prisma.evaluationJob.findUnique({
                where: {
                    submissionId_evaluationKey: {
                        submissionId,
                        evaluationKey,
                    },
                },
            });
        }

        if (job && idempotencyKey) {
            if (job.idempotencyKey && job.idempotencyKey !== idempotencyKey) {
                return res.status(409).json({
                    error: "Idempotency-Key does not match the existing evaluation request",
                });
            }

            if (!job.idempotencyKey) {
                job = await prisma.evaluationJob.update({
                    where: { id: job.id },
                    data: { idempotencyKey },
                });
            }
        }

        let isNewJob = false;

        if (!job) {
            try {
                job = await prisma.evaluationJob.create({
                    data: {
                        submissionId,
                        rubricId,
                        evaluationKey,
                        status: "QUEUED",
                        idempotencyKey: idempotencyKey ?? null,
                    },
                });

                isNewJob = true;
            } catch (error: unknown) {
                // Another request may have created the same job concurrently.
                job = await prisma.evaluationJob.findUnique({
                    where: {
                        submissionId_evaluationKey: {
                            submissionId,
                            evaluationKey,
                        },
                    },
                });

                if (!job) {
                    throw error;
                }
            }
        }

        // Only publish a newly created job.
        // Existing jobs must not be placed on the queue again.
        if (isNewJob) {
            const queueJob: SubmissionProcessingJob = {
                jobId: job.id,
                submissionId: job.submissionId,
                artifactId: artifact.id,
                type: "EVALUATION",
                evaluationJobId: job.id,
            };

            await queue.publish(queueJob);

            await prisma.submission.update({
                where: { id: submissionId },
                data: {
                    status: "QUEUED",
                },
            });
        }

        return res.status(202).json({
            id: job.id,
            submissionId: job.submissionId,
            rubricId: job.rubricId,
            status: job.status,
        });
    } catch (error) {
        console.error("[API] Failed to create evaluation:", error);

        return res.status(500).json({
            error: "Failed to create evaluation",
        });
    }
});

/**
 * Retry a failed evaluation.
 */
router.post("/:id/retry", async (req, res) => {
    try {
        const { id } = req.params;

        if (!isUuid(id)) {
            return res.status(400).json({
                error: "Invalid evaluation id",
            });
        }

        const job = await prisma.evaluationJob.findUnique({
            where: { id },
            include: {
                submission: {
                    include: {
                        artifacts: true,
                    },
                },
            },
        });

        if (!job) {
            return res.status(404).json({
                error: "Evaluation not found",
            });
        }

        if (job.status !== "FAILED") {
            return res.status(409).json({
                error: "Only failed evaluations can be retried",
                status: job.status,
            });
        }

        const latestAttempt = await prisma.evaluationAttempt.findFirst({
            where: {
                evaluationJobId: job.id,
            },
            orderBy: {
                attemptNumber: "desc",
            },
        });

        const attemptCount = latestAttempt?.attemptNumber ?? 0;
        const maxAttempts = 3;

        if (attemptCount >= maxAttempts) {
            return res.status(409).json({
                error: "Maximum retry attempts reached",
                attempts: attemptCount,
                maxAttempts,
            });
        }

        const artifact = job.submission.artifacts[0];

        if (!artifact) {
            return res.status(400).json({
                error: "Submission has no artifact",
            });
        }

        const updatedJob = await prisma.evaluationJob.update({
            where: { id: job.id },
            data: {
                status: "QUEUED",
                startedAt: null,
                completedAt: null,
            },
        });

        const queueJob: SubmissionProcessingJob = {
            jobId: updatedJob.id,
            submissionId: updatedJob.submissionId,
            artifactId: artifact.id,
            type: "EVALUATION",
            evaluationJobId: updatedJob.id,
        };

        await queue.publish(queueJob);

        await prisma.submission.update({
            where: { id: job.submissionId },
            data: {
                status: "QUEUED",
            },
        });

        return res.status(202).json({
            id: updatedJob.id,
            submissionId: updatedJob.submissionId,
            rubricId: updatedJob.rubricId,
            status: updatedJob.status,
            retryAttempt: attemptCount + 1,
            maxAttempts,
        });
    } catch (error) {
        console.error("[API] Failed to retry evaluation:", error);

        return res.status(500).json({
            error: "Failed to retry evaluation",
        });
    }
});

/**
 * Get an evaluation job and its final result.
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!isUuid(id)) {
            return res.status(400).json({
                error: "Invalid evaluation id",
            });
        }

        const job = await prisma.evaluationJob.findUnique({
            where: { id },
            include: {
                result: {
                    include: {
                        criteria: true,
                    },
                },
                humanReview: true,
            },
        });

        if (!job) {
            return res.status(404).json({
                error: "Evaluation not found",
            });
        }

        return res.json(job);
    } catch (error) {
        console.error("[API] Failed to fetch evaluation:", error);

        return res.status(500).json({
            error: "Failed to fetch evaluation",
        });
    }
});

/**
 * Get the evaluation associated with a submission.
 */
router.get("/submission/:submissionId", async (req, res) => {
    try {
        const { submissionId } = req.params;

        if (!isUuid(submissionId)) {
            return res.status(400).json({
                error: "Invalid submission id",
            });
        }

        const jobs = await prisma.evaluationJob.findMany({
            where: { submissionId },
            orderBy: { createdAt: "desc" },
            include: {
                result: {
                    include: {
                        criteria: true,
                    },
                },
                humanReview: true,
            },
        });

        return res.json({
            submissionId,
            evaluations: jobs,
        });
    } catch (error) {
        console.error("[API] Failed to fetch submission evaluations:", error);

        return res.status(500).json({
            error: "Failed to fetch submission evaluations",
        });
    }
});

export default router;