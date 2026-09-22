import type { CriterionEvaluation } from "../../../../packages/shared/src/evaluation/types.js";
import { MockLLMProvider } from "./llm/mock-llm.provider.js";
import { EvidencePromptService } from "./evidence-prompt.service.js";
import { RubricRetrievalService } from "./rubric-retrieval.service.js";
import type { ProjectManifest } from "./project-analyzer.service.js";
import type { RubricCriterion } from "./rubric-context.service.js";

export class CriterionEvaluationService {
  private readonly retrieval: RubricRetrievalService;
  private readonly promptService: EvidencePromptService;
  private readonly llm: MockLLMProvider;

  constructor() {
    this.retrieval = new RubricRetrievalService();
    this.promptService = new EvidencePromptService();
    this.llm = new MockLLMProvider();
  }

  async evaluate(
    submissionId: string,
    criterion: RubricCriterion,
    manifest: ProjectManifest,
  ): Promise<CriterionEvaluation> {
    const evidence = await this.retrieval.retrieve(
      submissionId,
      criterion,
      5,
    );

    const prompt = this.promptService.build(
      criterion,
      manifest,
      evidence,
    );

    console.log(
      `[Evaluation] Evaluating criterion: ${criterion.name}`,
    );

    console.log(
      `[Evaluation] Retrieved evidence: ${evidence.length} chunks`,
    );

    // The mock provider ignores the prompt for now.
    // A real provider will receive this exact evidence-aware prompt.
    return this.llm.evaluateCriterion(prompt);
  }
}