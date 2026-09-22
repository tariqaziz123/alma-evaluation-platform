import { GitHubService } from "./github.service.js";
import { GitHubContentService } from "./github-content.service.js";
import { filterRepositoryFiles } from "./file-filter.service.js";

export type ExtractedFile = {
  path: string;
  content: string;
  size: number;
};

export type ExtractedProject = {
  sourceUrl: string;
  owner: string;
  repository: string;
  defaultBranch: string;
  files: ExtractedFile[];
};

export class RepositoryExtractor {
  private readonly github: GitHubService;
  private readonly contentService: GitHubContentService;

  constructor(githubToken?: string) {
    this.github = new GitHubService(githubToken);
    this.contentService = new GitHubContentService(githubToken);
  }

  async extract(sourceUrl: string): Promise<ExtractedProject> {
    const repository = await this.github.getRepository(sourceUrl);

    const tree = await this.github.getRepositoryTree(sourceUrl);

    const files = filterRepositoryFiles(tree);

    const extractedFiles: ExtractedFile[] = [];

    for (const file of files) {
      const content = await this.contentService.getFileContent(
        repository.owner,
        repository.repository,
        file.path,
      );

      extractedFiles.push({
        path: file.path,
        content,
        size: file.size!,
      });
    }

    return {
      sourceUrl,
      owner: repository.owner,
      repository: repository.repository,
      defaultBranch: repository.defaultBranch,
      files: extractedFiles,
    };
  }
}