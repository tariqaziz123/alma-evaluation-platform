import { Octokit } from "octokit";

const MAX_CONTENT_SIZE = 2 * 1024 * 1024;
export class GitHubContentService {
    private readonly octokit: Octokit;

    constructor(token?: string) {
        this.octokit = new Octokit({ auth: token });
    }

    async getFileContent(
        owner: string,
        repository: string,
        path: string,
    ): Promise<string> {
        const response = await this.octokit.rest.repos.getContent({
            owner,
            repo: repository,
            path,
        });

        if (Array.isArray(response.data)) {
            throw new Error(`Expected a file but received a directory: ${path}`);
        }

        if (response.data.type !== "file") {
            throw new Error(`Unsupported GitHub content type: ${response.data.type}`);
        }

        if (!response.data.content) {
            throw new Error(`No content returned for file: ${path}`);
        }

        if (response.data.size > MAX_CONTENT_SIZE) {
            throw new Error(
                `File exceeds maximum supported size: ${path}`,
            );
        }

        return Buffer.from(response.data.content, "base64").toString("utf-8");
    }
}