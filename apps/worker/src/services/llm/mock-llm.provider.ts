import type {
    CriterionEvaluation,
    LLMProvider,
} from "../../../../../packages/shared/src/evaluation/types.js";

import { CriterionEvaluationSchema } from "../../../../../packages/shared/src/evaluation/schema.js";

export class MockLLMProvider implements LLMProvider {
    async evaluateCriterion(
        prompt: string,
    ): Promise<CriterionEvaluation> {
        const criterion = this.extractCriterion(prompt);

        const maxScore = this.getMaxScore(criterion);

        const result: CriterionEvaluation = {
            criterion,
            score: Math.round(maxScore * 0.8),
            maxScore,
            confidence: 0.85,
            evidence: [
                {
                    file: "README.md",
                    explanation:
                        "Mock evidence for development and pipeline testing.",
                },
            ],
            issues: [],
        };

        return CriterionEvaluationSchema.parse(result);
    }

    private extractCriterion(prompt: string): string {
        const match = prompt.match(
            /RUBRIC CRITERION:\s*(?:\r?\n)?([^\r\n]+)/i,
        );

        return match?.[1]?.trim() ?? "Unknown";
    }

    private getMaxScore(criterion: string): number {
        const normalized = criterion.toLowerCase();

        if (normalized.includes("functionality")) return 25;
        if (normalized.includes("code quality")) return 20;
        if (normalized.includes("architecture")) return 20;
        if (normalized.includes("problem solving")) return 15;
        if (normalized.includes("documentation")) return 10;
        if (
            normalized.includes("innovation") ||
            normalized.includes("ai")
        ) {
            return 10;
        }

        return 10;
    }
}