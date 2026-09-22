import { ProjectAnalyzer } from "./services/project-analyzer.service.js";
import { RubricContextService } from "./services/rubric-context.service.js";

const files = [
  {
    path: "package.json",
    size: 250,
    content: "{}",
  },
  {
    path: "README.md",
    size: 500,
    content: "# Project Documentation",
  },
  {
    path: "src/services/payment.service.ts",
    size: 800,
    content: "export function processPayment() {}",
  },
  {
    path: "src/components/Button.tsx",
    size: 500,
    content: "export function Button() {}",
  },
  {
    path: "src/components/Button.test.tsx",
    size: 400,
    content: "test('button works', () => {})",
  },
  {
    path: "src/ai/evaluator.ts",
    size: 900,
    content: "const prompt = 'evaluate project';",
  },
];

const analyzer = new ProjectAnalyzer();
const manifest = analyzer.analyze(files);

const service = new RubricContextService();

const criteria = [
  {
    name: "Functionality",
    description: "Does the project work correctly?",
  },
  {
    name: "Code Quality",
    description: "Is the implementation maintainable?",
  },
  {
    name: "Innovation/AI Usage",
    description: "Does the project use AI meaningfully?",
  },
];

for (const criterion of criteria) {
  const context = service.build(
    criterion,
    manifest,
    files,
  );

  console.log(`\n=== ${criterion.name} ===`);

  for (const file of context.files) {
    console.log(file.path);
  }
}