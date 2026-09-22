import { EvidencePromptService } from "./evidence-prompt.service.js";

const service = new EvidencePromptService();

const prompt = service.build(
  {
    name: "Documentation",
    description:
      "Evaluate the quality and completeness of project documentation.",
  },
  {
    projectName: "student-project",
    languages: ["TypeScript"],
    frameworks: ["Next.js", "React"],
    packageManager: "npm",
    dependencies: ["next", "react"],
    scripts: ["dev", "build", "test"],
    hasReadme: true,
    hasTests: true,
    hasDocker: true,
    importantFiles: [
      "package.json",
      "README.md",
      "Dockerfile",
    ],
  },
  [
    {
      filePath: "README.md",
      content:
        "# Student Project\n\nThis project provides an evaluation dashboard.",
      similarity: 0.91,
    },
  ],
);

console.log(prompt);