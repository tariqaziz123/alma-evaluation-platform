import { prisma } from "../lib/prisma.js";
import { RedisQueue } from "../../../../packages/shared/src/queue/redis-queue.js";

const REVIEW_CONFIDENCE_THRESHOLD = 0.7;
const queue = new RedisQueue(
    process.env.REDIS_URL ?? "redis://localhost:6379",
);

export class HumanReviewService {
    shouldRequireReview(
        criteria: Array<{
            confidence: number | null;
            evidence: unknown;
        }>,
    ): boolean {
        if (criteria.length === 0) {
            return true;
        }

        return criteria.some((criterion) => {
            const confidence = criterion.confidence ?? 0;

            const evidenceCount = Array.isArray(criterion.evidence)
                ? criterion.evidence.length
                : 0;

            return (
                confidence < REVIEW_CONFIDENCE_THRESHOLD ||
                evidenceCount === 0
            );
        });
    }

    async requestReview(evaluationJobId: string) {
        const job = await prisma.evaluationJob.findUnique({
            where: { id: evaluationJobId },
            include: {
                humanReview: true,
            },
        });

        if (!job) {
            throw new Error("Evaluation not found");
        }

        if (job.humanReview) {
            return job.humanReview;
        }

        const review = await prisma.$transaction(async (tx) => {
            const created = await tx.humanReview.create({
                data: {
                    evaluationJobId,
                    status: "REQUESTED",
                },
            });

            await tx.evaluationJob.update({
                where: { id: evaluationJobId },
                data: {
                    status: "HUMAN_REVIEW",
                },
            });

            await tx.auditLog.create({
                data: {
                    action: "HUMAN_REVIEW_REQUESTED",
                    entityType: "EvaluationJob",
                    entityId: evaluationJobId,
                    metadata: {
                        reviewId: created.id,
                    },
                },
            });

            return created;
        });

        return review;
    }

    async claimReview(reviewId: string, reviewerId: string) {
        const reviewer = await prisma.user.findUnique({
            where: { id: reviewerId },
        });

        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        if (reviewer.role !== "INSTRUCTOR" && reviewer.role !== "ADMIN") {
            throw new Error("User is not authorized to review evaluations");
        }

        const updated = await prisma.$transaction(async (tx) => {
            const review = await tx.humanReview.findUnique({
                where: { id: reviewId },
            });

            if (!review) {
                throw new Error("Human review not found");
            }

            if (review.status !== "REQUESTED") {
                throw new Error(
                    `Review cannot be claimed from status ${review.status}`,
                );
            }

            const claimed = await tx.humanReview.updateMany({
                where: {
                    id: reviewId,
                    status: "REQUESTED",
                    reviewerId: null,
                },
                data: {
                    reviewerId,
                    status: "IN_PROGRESS",
                },
            });

            if (claimed.count !== 1) {
                throw new Error(
                    "Review was already claimed by another reviewer",
                );
            }

            await tx.auditLog.create({
                data: {
                    userId: reviewerId,
                    action: "HUMAN_REVIEW_CLAIMED",
                    entityType: "HumanReview",
                    entityId: reviewId,
                },
            });

            return tx.humanReview.findUniqueOrThrow({
                where: { id: reviewId },
            });
        });

        return updated;
    }

    async decideReview(
        reviewId: string,
        reviewerId: string,
        decision: "APPROVED" | "REJECTED",
        comments?: string,
        finalScore?: number,
    ) {
        const reviewer = await prisma.user.findUnique({
            where: { id: reviewerId },
        });

        if (!reviewer) {
            throw new Error("Reviewer not found");
        }

        if (reviewer.role !== "INSTRUCTOR" && reviewer.role !== "ADMIN") {
            throw new Error("User is not authorized to review evaluations");
        }

        const review = await prisma.humanReview.findUnique({
            where: { id: reviewId },
            include: {
                evaluationJob: true,
            },
        });

        if (!review) {
            throw new Error("Human review not found");
        }

        if (review.status !== "IN_PROGRESS") {
            throw new Error(
                `Review must be IN_PROGRESS before a decision can be made`,
            );
        }

        if (review.reviewerId !== reviewerId) {
            throw new Error("Review is assigned to another reviewer");
        }

        if (
            finalScore !== undefined &&
            (!Number.isFinite(finalScore) || finalScore < 0)
        ) {
            throw new Error("finalScore must be a non-negative number");
        }

        const updated = await prisma.$transaction(async (tx) => {
            const completedReview = await tx.humanReview.update({
                where: { id: reviewId },
                data: {
                    status: decision,
                    comments: comments?.trim() || null,
                    finalScore: finalScore ?? null,
                    completedAt: new Date(),
                },
            });

            await tx.evaluationJob.update({
                where: { id: review.evaluationJobId },
                data: {
                    status: decision === "APPROVED" ? "COMPLETED" : "QUEUED",
                    completedAt:
                        decision === "APPROVED" ? new Date() : null,
                },
            });

            if (decision === "APPROVED") {
                await tx.submission.update({
                    where: {
                        id: review.evaluationJob.submissionId,
                    },
                    data: {
                        status: "COMPLETED",
                    },
                });
            }

            if (decision === "REJECTED") {
                const submission = await tx.submission.findUnique({
                    where: {
                        id: review.evaluationJob.submissionId,
                    },
                    include: {
                        artifacts: true,
                    },
                });

                const artifact = submission?.artifacts[0];

                if (!artifact) {
                    throw new Error("Submission has no artifact to requeue");
                }

                await queue.publish({
                    jobId: review.evaluationJob.id,
                    submissionId: review.evaluationJob.submissionId,
                    artifactId: artifact.id,
                    type: "EVALUATION",
                    evaluationJobId: review.evaluationJob.id,
                });
            }

            await tx.auditLog.create({
                data: {
                    userId: reviewerId,
                    action:
                        decision === "APPROVED"
                            ? "HUMAN_REVIEW_APPROVED"
                            : "HUMAN_REVIEW_REJECTED",
                    entityType: "HumanReview",
                    entityId: reviewId,
                    metadata: {
                        evaluationJobId: review.evaluationJobId,
                        finalScore: finalScore ?? null,
                    },
                },
            });

            return completedReview;
        });

        return updated;
    }
}