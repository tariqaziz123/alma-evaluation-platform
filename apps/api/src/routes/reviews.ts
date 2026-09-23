import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { HumanReviewService } from "../services/human-review.service.js";

const router = Router();
const reviewService = new HumanReviewService();

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

router.get("/:id", async (req, res) => {
  try {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({
        error: "Invalid review id",
      });
    }

    const review = await prisma.humanReview.findUnique({
      where: { id: req.params.id },
      include: {
        evaluationJob: {
          include: {
            result: {
              include: {
                criteria: true,
              },
            },
          },
        },
        reviewer: true,
      },
    });

    if (!review) {
      return res.status(404).json({
        error: "Human review not found",
      });
    }

    return res.json(review);
  } catch (error) {
    console.error("[API] Failed to get human review:", error);

    return res.status(500).json({
      error: "Failed to get human review",
    });
  }
});

router.post("/:id/claim", async (req, res) => {
  try {
    const reviewId = req.params.id;
    const { reviewerId } = req.body;

    if (!isUuid(reviewId) || !isUuid(reviewerId)) {
      return res.status(400).json({
        error: "review id and reviewerId must be valid UUIDs",
      });
    }

    const review = await reviewService.claimReview(
      reviewId,
      reviewerId,
    );

    return res.json(review);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to claim review";

    console.error("[API] Failed to claim review:", error);

    return res.status(409).json({
      error: message,
    });
  }
});

router.post("/:id/decision", async (req, res) => {
  try {
    const reviewId = req.params.id;
    const {
      reviewerId,
      decision,
      comments,
      finalScore,
    } = req.body;

    if (!isUuid(reviewId) || !isUuid(reviewerId)) {
      return res.status(400).json({
        error: "review id and reviewerId must be valid UUIDs",
      });
    }

    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return res.status(400).json({
        error: "decision must be APPROVED or REJECTED",
      });
    }

    const review = await reviewService.decideReview(
      reviewId,
      reviewerId,
      decision,
      typeof comments === "string" ? comments : undefined,
      typeof finalScore === "number" ? finalScore : undefined,
    );

    return res.json(review);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to decide review";

    console.error("[API] Failed to decide review:", error);

    return res.status(409).json({
      error: message,
    });
  }
});

export default router;