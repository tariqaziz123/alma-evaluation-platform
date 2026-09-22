import { Octokit } from "octokit";

export type GitHubRepository = {
    owner: string;
    repository: string;
    defaultBranch: string;
};

export class GitHubService {
    private readonly octokit: Octokit;

    constructor(token?: string) {
        this.octokit = new Octokit({
            auth: token,
        });
    }

    parseRepositoryUrl(sourceUrl: string): {
        owner: string;
        repository: string;
    } {
        const url = new URL(sourceUrl);

        if (url.hostname !== "github.com") {
            throw new Error("Only GitHub repositories are supported");
        }

        const parts = url.pathname
            .split("/")
            .filter(Boolean);

        if (parts.length < 2) {
            throw new Error("Invalid GitHub repository URL");
        }

        const [owner, repositoryWithSuffix] = parts;

        const repository = repositoryWithSuffix.replace(
            /\.git$/,
            "",
        );

        if (!owner || !repository) {
            throw new Error("Invalid GitHub repository URL");
        }

        return {
            owner,
            repository,
        };
    }

    async getRepository(
        sourceUrl: string,
    ): Promise<GitHubRepository> {
        const { owner, repository } =
            this.parseRepositoryUrl(sourceUrl);

        const response =
            await this.octokit.rest.repos.get({
                owner,
                repo: repository,
            });

        return {
            owner,
            repository,
            defaultBranch: response.data.default_branch,
        };
    }

    async getRepositoryTree(
        sourceUrl: string,
    ): Promise<
        Array<{
            path: string;
            type: "blob" | "tree";
            size?: number;
            sha: string;
        }>
    > {
        const repository = await this.getRepository(sourceUrl);

        const response =
            await this.octokit.rest.git.getTree({
                owner: repository.owner,
                repo: repository.repository,
                tree_sha: repository.defaultBranch,
                recursive: "true",
            });
        
        if (response.data.truncated) {
            throw new Error(
                "GitHub repository tree is too large to process safely",
            );
        }

        return response.data.tree
            .filter(
                (item) =>
                    Boolean(item.path) &&
                    (item.type === "blob" || item.type === "tree") &&
                    Boolean(item.sha)
            )
            .map((item) => ({
                path: item.path!,
                type: item.type as "blob" | "tree",
                size: item.size,
                sha: item.sha!,
            }));
    }
}