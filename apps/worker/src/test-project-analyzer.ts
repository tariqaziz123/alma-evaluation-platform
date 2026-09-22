import { ProjectAnalyzer } from "./services/project-analyzer.service.js";

const files = [
  {
    path: "package.json",
    size: 250,
    content: JSON.stringify({
      name: "student-project",
      scripts: {
        dev: "next dev",
        build: "next build",
        test: "jest",
      },
      dependencies: {
        next: "15.0.0",
        react: "19.0.0",
      },
      devDependencies: {
        typescript: "5.0.0",
        jest: "30.0.0",
      },
    }),
  },
  {
    path: "README.md",
    size: 1000,
    content: "# Student Project",
  },
  {
    path: "app/page.tsx",
    size: 500,
    content: "export default function Page() {}",
  },
  {
    path: "app/page.test.tsx",
    size: 400,
    content: "test('works', () => {})",
  },
  {
    path: "Dockerfile",
    size: 300,
    content: "FROM node:22",
  },
  {
    path: "tsconfig.json",
    size: 200,
    content: "{}",
  },
  {
  path: "package-lock.json",
  size: 500,
  content: "{}",
},
];

const analyzer = new ProjectAnalyzer();

const manifest = analyzer.analyze(files);

console.log(JSON.stringify(manifest, null, 2));