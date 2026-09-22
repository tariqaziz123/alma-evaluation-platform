import { z } from "zod";

export const EvaluationEvidenceSchema = z.object({
  file: z.string().min(1),
  explanation: z.string().min(1),
});

export const CriterionEvaluationSchema = z
  .object({
    criterion: z.string().min(1),
    score: z.number().min(0),
    maxScore: z.number().positive(),
    confidence: z.number().min(0).max(1),
    evidence: z.array(EvaluationEvidenceSchema),
    issues: z.array(z.string()),
  })
  .refine(
    (data) => data.score <= data.maxScore,
    {
      message: "Score cannot exceed maxScore",
      path: ["score"],
    },
  );

export const ProjectEvaluationSchema = z.object({
  summary: z.string().min(1),
  criteria: z.array(CriterionEvaluationSchema),
});

export type ValidatedProjectEvaluation = z.infer<
  typeof ProjectEvaluationSchema
>;

export type ValidatedCriterionEvaluation = z.infer<
  typeof CriterionEvaluationSchema
>;