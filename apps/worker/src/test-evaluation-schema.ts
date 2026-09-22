import { ProjectEvaluationSchema } from "../../../packages/shared/src/evaluation/schema.js";

const validEvaluation = {
  summary: "The project implements the requested functionality.",
  criteria: [
    {
      criterion: "Functionality",
      score: 20,
      maxScore: 25,
      confidence: 0.9,
      evidence: [
        {
          file: "src/app.ts",
          explanation: "The main workflow is implemented.",
        },
      ],
      issues: [],
    },
  ],
};

const invalidEvaluation = {
  summary: "Invalid evaluation",
  criteria: [
    {
      criterion: "Functionality",
      score: 30,
      maxScore: 25,
      confidence: 2,
      evidence: [],
      issues: [],
    },
  ],
};

console.log("Valid result:");
console.log(
  ProjectEvaluationSchema.safeParse(validEvaluation).success,
);

console.log("Invalid result:");
console.log(
  ProjectEvaluationSchema.safeParse(invalidEvaluation).success,
);