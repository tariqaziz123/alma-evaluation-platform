import type {
  LLMProvider,
  ProjectEvaluation,
} from "../../../../../packages/shared/src/evaluation/types.js";
import { ProjectEvaluationSchema } from "../../../../../packages/shared/src/evaluation/schema.js";

export class MockLLMProvider implements LLMProvider {
  async evaluate(_prompt: string): Promise<ProjectEvaluation> {
    const result: ProjectEvaluation = {
      summary: "Mock evaluation for development.",
      criteria: [
        {
          criterion: "Functionality",
          score: 20,
          maxScore: 25,
          confidence: 0.85,
          evidence: [
            {
              file: "src/components/Button.test.tsx",
              explanation:
                "Automated test demonstrates expected behavior.",
            },
          ],
          issues: [],
        },
      ],
    };

    return ProjectEvaluationSchema.parse(result);
  }
}