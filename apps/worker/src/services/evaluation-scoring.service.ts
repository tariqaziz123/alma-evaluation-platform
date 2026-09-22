import type { CriterionEvaluation } from "../../../../packages/shared/src/evaluation/types.js";

export type ScoringCriterion = {
  name: string;
  weight: number;
  maxScore: number;
};

export type ScoringResult = {
  totalScore: number;
  maxScore: number;
  percentage: number;
};

export class EvaluationScoringService {
  calculate(
    criteria: ScoringCriterion[],
    evaluations: CriterionEvaluation[],
  ): ScoringResult {
    let totalScore = 0;
    let maxScore = 0;

    for (const criterion of criteria) {
      const evaluation = evaluations.find(
        (item) =>
          item.criterion.toLowerCase() === criterion.name.toLowerCase(),
      );

      if (!evaluation) {
        continue;
      }

      const safeMaxScore = Math.max(criterion.maxScore, 0);
      const safeWeight = Math.max(criterion.weight, 0);

      if (safeMaxScore === 0 || safeWeight === 0) {
        continue;
      }

      const score = Math.min(
        Math.max(evaluation.score, 0),
        safeMaxScore,
      );

      // Normalize the criterion score and apply its rubric weight.
      const weightedScore = (score / safeMaxScore) * safeWeight;

      totalScore += weightedScore;
      maxScore += safeWeight;
    }

    const percentage =
      maxScore === 0
        ? 0
        : Number(((totalScore / maxScore) * 100).toFixed(2));

    return {
      totalScore: Number(totalScore.toFixed(2)),
      maxScore: Number(maxScore.toFixed(2)),
      percentage,
    };
  }
}