import { MockLLMProvider } from "./services/llm/mock-llm.provider.js";

const provider = new MockLLMProvider();

const prompt = `
You are evaluating a student software project.

RUBRIC CRITERION:
Architecture

CRITERION DESCRIPTION:
Evaluate the overall architecture of the project.
`;

const result = await provider.evaluateCriterion(prompt);

console.log(JSON.stringify(result, null, 2));