import { prisma } from "../lib/prisma.js";

export class HumanReviewService {
  async requestReview(evaluationJobId: string) {
    const job = await prisma.evaluationJob.findUnique({
      where: {
        id: evaluationJobId,
      },
      include: {
        humanReview: true,
      },
    });

    if (!job) {
      throw new Error(
        `Evaluation job not found: ${evaluationJobId}`,
      );
    }
if (job.humanReview) {
  if (job.humanReview.status === "REJECTED") {
    return prisma.$transaction(async (tx) => {
      const reopened = await tx.humanReview.update({
        where: { id: job.humanReview!.id },
        data: {
          status: "REQUESTED",
          reviewerId: null,
          comments: null,
          finalScore: null,
          completedAt: null,
        },
      });

      await tx.evaluationJob.update({
        where: { id: evaluationJobId },
        data: {
          status: "HUMAN_REVIEW",
          completedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "HUMAN_REVIEW_REQUESTED",
          entityType: "EvaluationJob",
          entityId: evaluationJobId,
          metadata: {
            reviewId: reopened.id,
            reopened: true,
          },
        },
      });

      return reopened;
    });
  }

  return job.humanReview;
}

    const review = await prisma.$transaction(async (tx) => {
      const createdReview = await tx.humanReview.create({
        data: {
          evaluationJobId,
          status: "REQUESTED",
        },
      });

      await tx.evaluationJob.update({
        where: {
          id: evaluationJobId,
        },
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
            reviewId: createdReview.id,
          },
        },
      });

      return createdReview;
    });

    console.log(
      `[HumanReview] Review requested for evaluation ${evaluationJobId}`,
    );

    return review;
  }
}