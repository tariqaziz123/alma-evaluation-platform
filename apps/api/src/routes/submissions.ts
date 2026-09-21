import { randomUUID } from "node:crypto";
import { RedisQueue } from "../../../../packages/shared/src/queue/redis-queue.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const queue = new RedisQueue(
  process.env.REDIS_URL ?? "redis://localhost:6379",
);
const router = Router();

const createSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  sourceType: z.enum([
    "GITHUB",
    "ZIP",
    "PDF",
    "GOOGLE_DRIVE",
    "VIDEO",
    "DOCUMENT",
    "LIVE_URL",
  ]),
  sourceUrl: z.string().url().optional(),
});

router.post("/", async (req, res) => {
  const parsed = createSubmissionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { assignmentId, studentId, sourceType, sourceUrl } = parsed.data;

  try {
    const [assignment, student] = await Promise.all([
      prisma.assignment.findUnique({
        where: { id: assignmentId },
      }),
      prisma.user.findUnique({
        where: { id: studentId },
      }),
    ]);

    if (!assignment) {
      return res.status(404).json({
        error: "Assignment not found",
      });
    }

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    if (student.role !== "STUDENT") {
      return res.status(400).json({
        error: "User is not a student",
      });
    }

    const submission = await prisma.submission.create({
      data: {
        assignmentId,
        studentId,
        status: "DRAFT",
        artifacts: {
          create: {
            type: sourceType,
            sourceUrl,
            status: "PENDING",
          },
        },
      },
      include: {
        artifacts: true,
      },
    });

    const artifact = submission.artifacts[0];

    if (!artifact) {
      return res.status(500).json({
        error: "Submission artifact was not created",
      });
    }

    await prisma.submission.update({
      where: {
        id: submission.id,
      },
      data: {
        status: "QUEUED",
      },
    });

    await queue.publish({
      jobId: randomUUID(),
      submissionId: submission.id,
      artifactId: artifact.id,
    });

    const queuedSubmission = await prisma.submission.findUnique({
      where: {
        id: submission.id,
      },
      include: {
        artifacts: true,
      },
    });

    return res.status(201).json({
      data: queuedSubmission,
    });
  } catch (error) {
    console.error("Failed to create submission", error);

    return res.status(500).json({
      error: "Failed to create submission",
    });
  }
});

export default router;
