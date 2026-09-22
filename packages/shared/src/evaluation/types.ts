export type EvaluationEvidence = {
  file: string;
  explanation: string;
};

export type CriterionEvaluation = {
  criterion: string;
  score: number;
  maxScore: number;
  confidence: number;
  evidence: EvaluationEvidence[];
  issues: string[];
};

export type ProjectEvaluation = {
  summary: string;
  criteria: CriterionEvaluation[];
};

export interface LLMProvider {
  evaluateCriterion(
    prompt: string,
  ): Promise<CriterionEvaluation>;
}