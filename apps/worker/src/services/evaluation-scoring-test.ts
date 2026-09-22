import { EvaluationScoringService } from "./evaluation-scoring.service.js";
import type { CriterionEvaluation } from "../../../../packages/shared/src/evaluation/types.js";

const service = new EvaluationScoringService();

const criteria = [
  { name: "Functionality", weight: 25, maxScore: 25 },
  { name: "Code Quality", weight: 20, maxScore: 20 },
  { name: "Architecture", weight: 20, maxScore: 20 },
  { name: "Problem Solving", weight: 15, maxScore: 15 },
  { name: "Documentation", weight: 10, maxScore: 10 },
  { name: "Innovation", weight: 10, maxScore: 10 },
];

const evaluations: CriterionEvaluation[] = [
  {
    criterion: "Functionality",
    score: 20,
    maxScore: 25,
    confidence: 0.9,
    evidence: [],
    issues: [],
  },
  {
    criterion: "Code Quality",
    score: 15,
    maxScore: 20,
    confidence: 0.9,
    evidence: [],
    issues: [],
  },
  {
    criterion: "Architecture",
    score: 16,
    maxScore: 20,
    confidence: 0.9,
    evidence: [],
    issues: [],
  },
  {
    criterion: "Problem Solving",
    score: 12,
    maxScore: 15,
    confidence: 0.9,
    evidence: [],
    issues: [],
  },
  {
    criterion: "Documentation",
    score: 8,
    maxScore: 10,
    confidence: 0.9,
    evidence: [],
    issues: [],
  },
  {
    criterion: "Innovation",
    score: 7,
    maxScore: 10,
    confidence: 0.9,
    evidence: [],
    issues: [],
  },
];

const result = service.calculate(criteria, evaluations);

console.log("Scoring result:", result);

if (result.totalScore !== 78) {
  throw new Error(
    `Expected totalScore 78, received ${result.totalScore}`,
  );
}

if (result.maxScore !== 100) {
  throw new Error(
    `Expected maxScore 100, received ${result.maxScore}`,
  );
}

if (result.percentage !== 78) {
  throw new Error(
    `Expected percentage 78, received ${result.percentage}`,
  );
}

console.log("✓ Weighted scoring test passed");