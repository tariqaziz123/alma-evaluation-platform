import { ProjectEvaluationSchema } from "./schema.js";

const invalidScore = ProjectEvaluationSchema.safeParse({
  summary: "Invalid score test",
  criteria: [
    {
      criterion: "Architecture",
      score: 25,
      maxScore: 20,
      confidence: 0.9,
      evidence: [],
      issues: [],
    },
  ],
});

console.log(
  "Score exceeds max:",
  invalidScore.success,
);