import type { EvaluationFile } from "./evaluation-context.service.js";
import type { ProjectManifest } from "./project-analyzer.service.js";

export type RubricCriterion = {
  name: string;
  description?: string;
};

export type RubricContext = {
  criterion: RubricCriterion;
  files: EvaluationFile[];
  manifest: ProjectManifest;
};

export class RubricContextService {
  build(
    criterion: RubricCriterion,
    manifest: ProjectManifest,
    files: EvaluationFile[],
  ): RubricContext {
    const name = criterion.name.toLowerCase();

    let relevantFiles: EvaluationFile[];

    if (name.includes("functionality")) {
      relevantFiles = files.filter(
        (file) =>
          /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(file.path) ||
          /(^|\/)(app|pages|src|components)\//i.test(file.path),
      );
    } else if (name.includes("code quality")) {
      relevantFiles = files.filter(
        (file) =>
          /\.(ts|tsx|js|jsx)$/i.test(file.path) &&
          !/\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(file.path),
      );
    } else if (name.includes("architecture")) {
      relevantFiles = files.filter(
        (file) =>
          /(config|router|routes|service|controller|module|store)/i.test(
            file.path,
          ) &&
          /\.(ts|tsx|js|jsx|json)$/i.test(file.path),
      );
    } else if (name.includes("documentation")) {
      relevantFiles = files.filter((file) =>
        /(^|\/)(README|docs?)(\/|\.|$)/i.test(file.path),
      );
    } else if (name.includes("innovation") || name.includes("ai")) {
      relevantFiles = files.filter(
        (file) =>
          /(ai|openai|gemini|llm|model|prompt|embedding|vector)/i.test(
            file.path,
          ) &&
          /\.(ts|tsx|js|jsx|json|md)$/i.test(file.path),
      );
    } else {
      relevantFiles = files.slice(0, 20);
    }

    return {
      criterion,
      manifest,
      files: relevantFiles.slice(0, 30),
    };
  }
}