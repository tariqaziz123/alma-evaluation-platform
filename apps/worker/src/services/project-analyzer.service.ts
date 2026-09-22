export type ProjectManifest = {
  projectName: string;
  languages: string[];
  frameworks: string[];
  packageManager?: string;
  dependencies: string[];
  scripts: string[];
  hasReadme: boolean;
  hasTests: boolean;
  hasDocker: boolean;
  importantFiles: string[];
};

type InputFile = {
  path: string;
  content: string;
  size: number;
};

export class ProjectAnalyzer {
  analyze(files: InputFile[]): ProjectManifest {
    const paths = files.map((file) => file.path);

    const packageJson = this.findFile(files, "package.json");
    const readme = this.findFileByName(files, "README.md");
    const dockerfile = this.findFileByName(files, "Dockerfile");

    const packageData = packageJson
      ? this.parsePackageJson(packageJson.content)
      : undefined;

    return {
      projectName:
        packageData?.name ??
        this.getProjectName(paths),

      languages: this.detectLanguages(paths),

      frameworks: this.detectFrameworks(packageData),

      packageManager: this.detectPackageManager(paths),

      dependencies: this.getDependencies(packageData),

      scripts: packageData?.scripts
        ? Object.keys(packageData.scripts)
        : [],

      hasReadme: Boolean(readme),

      hasTests: this.hasTests(paths),

      hasDocker: Boolean(dockerfile),

      importantFiles: this.findImportantFiles(paths),
    };
  }

  private findFile(
    files: InputFile[],
    fileName: string,
  ): InputFile | undefined {
    return files.find((file) => file.path === fileName);
  }

  private findFileByName(
    files: InputFile[],
    fileName: string,
  ): InputFile | undefined {
    return files.find((file) => {
      const parts = file.path.split("/");
      return parts[parts.length - 1]?.toLowerCase() === fileName.toLowerCase();
    });
  }

  private parsePackageJson(content: string): {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | undefined {
    try {
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  private detectLanguages(paths: string[]): string[] {
    const languages = new Set<string>();

    for (const path of paths) {
      const extension = this.getExtension(path);

      switch (extension) {
        case ".ts":
        case ".tsx":
          languages.add("TypeScript");
          break;

        case ".js":
        case ".jsx":
          languages.add("JavaScript");
          break;

        case ".py":
          languages.add("Python");
          break;

        case ".java":
          languages.add("Java");
          break;

        case ".go":
          languages.add("Go");
          break;

        case ".rs":
          languages.add("Rust");
          break;
      }
    }

    return [...languages];
  }

  private detectFrameworks(
    packageData:
      | {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }
      | undefined,
  ): string[] {
    if (!packageData) {
      return [];
    }

    const dependencies = {
      ...packageData.dependencies,
      ...packageData.devDependencies,
    };

    const frameworks: string[] = [];

    if (dependencies["next"]) frameworks.push("Next.js");
    if (dependencies["react"]) frameworks.push("React");
    if (dependencies["vue"]) frameworks.push("Vue");
    if (dependencies["@angular/core"]) frameworks.push("Angular");
    if (dependencies["express"]) frameworks.push("Express");
    if (dependencies["nestjs"]) frameworks.push("NestJS");

    return frameworks;
  }

  private detectPackageManager(paths: string[]): string | undefined {
    if (paths.includes("pnpm-lock.yaml")) return "pnpm";
    if (paths.includes("yarn.lock")) return "yarn";
    if (paths.includes("package-lock.json")) return "npm";
    if (paths.includes("bun.lockb") || paths.includes("bun.lock"))
      return "bun";

    return undefined;
  }

  private getDependencies(
    packageData:
      | {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }
      | undefined,
  ): string[] {
    if (!packageData) {
      return [];
    }

    return Object.keys({
      ...packageData.dependencies,
      ...packageData.devDependencies,
    });
  }

  private hasTests(paths: string[]): boolean {
    return paths.some((path) =>
      /(^|\/)(__tests__|tests?)(\/|$)|\.(test|spec)\.[^.]+$/i.test(path),
    );
  }

  private findImportantFiles(paths: string[]): string[] {
    const importantNames = new Set([
      "package.json",
      "README.md",
      "Dockerfile",
      "docker-compose.yml",
      "docker-compose.yaml",
      "tsconfig.json",
      "next.config.js",
      "next.config.ts",
      "vite.config.ts",
    ]);

    return paths.filter((path) => {
      const fileName = path.split("/").pop();
      return fileName ? importantNames.has(fileName) : false;
    });
  }

  private getProjectName(paths: string[]): string {
    const firstDirectory = paths[0]?.split("/")[0];

    return firstDirectory || "Unknown Project";
  }

  private getExtension(path: string): string {
    const fileName = path.split("/").pop() ?? "";
    const index = fileName.lastIndexOf(".");

    return index === -1
      ? ""
      : fileName.slice(index).toLowerCase();
  }
}