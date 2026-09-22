import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import type { ProjectEvaluation } from "../../../../packages/shared/src/evaluation/types.js";

export class EvaluationPersistenceService {
  async save(
    evaluationJobId: string,
    evaluation: ProjectEvaluation,
  ): Promise<void> {
    const job = await prisma.evaluationJob.findUnique({
      where: {
        id: evaluationJobId,
      },
      include: {
        rubric: {
          include: {
            criteria: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error(
        `Evaluation job not found: ${evaluationJobId}`,
      );
    }

    const criterionMap = new Map(
      job.rubric.criteria.map((criterion) => [
        criterion.name.toLowerCase(),
        criterion,
      ]),
    );

    let totalScore = 0;
    let maxScore = 0;

    await prisma.$transaction(async (tx) => {
      const result = await tx.evaluationResult.upsert({
        where: {
          evaluationJobId,
        },
        update: {
          totalScore: 0,
          maxScore: 0,
          summary: evaluation.summary,
        },
        create: {
          id: randomUUID(),
          evaluationJobId,
          totalScore: 0,
          maxScore: 0,
          summary: evaluation.summary,
        },
      });

      await tx.evaluationCriterionResult.deleteMany({
        where: {
          evaluationResultId: result.id,
        },
      });

      for (const criterionResult of evaluation.criteria) {
        const rubricCriterion = criterionMap.get(
          criterionResult.criterion.toLowerCase(),
        );

        if (!rubricCriterion) {
          console.warn(
            `[Persistence] Unknown criterion from LLM: ${criterionResult.criterion}`,
          );
          continue;
        }

        const score = Math.min(
          Math.max(criterionResult.score, 0),
          Number(rubricCriterion.maxScore),
        );

        const criterionMaxScore = Number(
          rubricCriterion.maxScore,
        );

        totalScore += score;
        maxScore += criterionMaxScore;

        await tx.evaluationCriterionResult.create({
          data: {
            id: randomUUID(),
            evaluationResultId: result.id,
            rubricCriterionId: rubricCriterion.id,
            score,
            maxScore: criterionMaxScore,
            confidence: criterionResult.confidence,
            reasoning: criterionResult.issues.join("\n"),
            evidence: criterionResult.evidence,
          },
        });
      }

      await tx.evaluationResult.update({
        where: {
          id: result.id,
        },
        data: {
          totalScore,
          maxScore,
        },
      });

      await tx.evaluationJob.update({
        where: {
          id: evaluationJobId,
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    });

    console.log(
      `[Persistence] Evaluation ${evaluationJobId} saved: ${totalScore}/${maxScore}`,
    );
  }
}