import { ProjectAnalyzer } from "./services/project-analyzer.service.js";
import { EvaluationContextService } from "./services/evaluation-context.service.js";

const files = [
  {
    path: "package.json",
    size: 250,
    content: JSON.stringify({
      name: "student-project",
      scripts: {
        dev: "next dev",
        test: "jest",
      },
      dependencies: {
        next: "15.0.0",
        react: "19.0.0",
      },
      devDependencies: {
        jest: "30.0.0",
      },
    }),
  },
  {
    path: "README.md",
    size: 500,
    content: "# Student Project\n\nThis is a sample project.",
  },
  {
    path: "app/page.tsx",
    size: 700,
    content: "export default function Page() {}",
  },
  {
    path: "app/page.test.tsx",
    size: 400,
    content: "test('works', () => {})",
  },
  {
    path: "components/Button.tsx",
    size: 500,
    content: "export function Button() {}",
  },
  {
    path: "utils/helper.ts",
    size: 300,
    content: "export function helper() {}",
  },
];

const analyzer = new ProjectAnalyzer();
const manifest = analyzer.analyze(files);

const contextService = new EvaluationContextService();

const context = contextService.build(manifest, files);

console.log(
  JSON.stringify(
    {
      manifest: context.manifest,
      readme: context.readme,
      relevantFiles: context.relevantFiles.map((file) => file.path),
    },
    null,
    2,
  ),
);