import type { ProjectManifest } from "./project-analyzer.service.js";

export type EvaluationFile = {
    path: string;
    content: string;
    size: number;
};

export type EvaluationContext = {
    manifest: ProjectManifest;
    readme?: string;
    relevantFiles: EvaluationFile[];
};

export class EvaluationContextService {

    private findDocumentationFiles(files: EvaluationFile[]): string[] {
        return files
            .filter((file) => {
                const name = file.path.split("/").pop()?.toLowerCase();

                return (
                    name === "readme" ||
                    name === "readme.md" ||
                    name === "readme.txt"
                );
            })
            .map((file) => file.path)
            .slice(0, 10);
    }
    build(
        manifest: ProjectManifest,
        files: EvaluationFile[],
    ): EvaluationContext {
        const relevantPaths = new Set([
            ...manifest.importantFiles,
            ...this.findSourceEntryPoints(files),
            ...this.findTestFiles(files),
            ...this.findDocumentationFiles(files),
        ]);

        const relevantFiles = files.filter((file) =>
            relevantPaths.has(file.path),
        );

        const readmeFile = files.find((file) => {
            const name = file.path.split("/").pop()?.toLowerCase();
            return name === "readme.md" || name === "readme";
        });

        return {
            manifest,
            readme: readmeFile?.content,
            relevantFiles,
        };
    }

    private findSourceEntryPoints(
        files: EvaluationFile[],
    ): string[] {
        return files
            .filter((file) =>
                /(^|\/)(main|index|app|page|layout|server)\.(ts|tsx|js|jsx)$/i.test(
                    file.path,
                ),
            )
            .map((file) => file.path)
            .slice(0, 20);
    }

    private findTestFiles(
        files: EvaluationFile[],
    ): string[] {
        return files
            .filter((file) =>
                /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(file.path),
            )
            .map((file) => file.path)
            .slice(0, 20);
    }
}