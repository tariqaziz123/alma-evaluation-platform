import { ProjectAnalyzer } from "./services/project-analyzer.service.js";
import { RubricContextService } from "./services/rubric-context.service.js";
import { EvaluationPromptService } from "./services/evaluation-prompt.service.js";

const files = [
  {
    path: "package.json",
    size: 250,
    content: JSON.stringify({
      name: "student-project",
      dependencies: {
        next: "15.0.0",
        react: "19.0.0",
      },
    }),
  },
  {
    path: "README.md",
    size: 500,
    content: "# Student Project",
  },
  {
    path: "src/components/Button.tsx",
    size: 700,
    content: `
      export function Button() {
        return <button>Submit</button>;
      }
    `,
  },
  {
    path: "src/components/Button.test.tsx",
    size: 400,
    content: `
      test("button renders", () => {});
    `,
  },
];

const analyzer = new ProjectAnalyzer();
const manifest = analyzer.analyze(files);

const rubricContextService = new RubricContextService();

const context = rubricContextService.build(
  {
    name: "Functionality",
    description:
      "Evaluate whether the implemented functionality works correctly.",
  },
  manifest,
  files,
);

const promptService = new EvaluationPromptService();

const prompt = promptService.build(context);

console.log(prompt);