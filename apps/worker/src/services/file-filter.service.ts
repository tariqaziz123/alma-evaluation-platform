const IGNORED_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    "vendor",
    "__pycache__",
]);

const IGNORED_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".mp4",
    ".mov",
    ".avi",
    ".zip",
    ".tar",
    ".gz",
    ".exe",
    ".dll",
    ".so",
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_FILES = 5000;

export type RepositoryFile = {
    path: string;
    type: "blob" | "tree";
    size?: number;
    sha: string;
};

export function filterRepositoryFiles(
    files: RepositoryFile[],
): RepositoryFile[] {
    return files
        .filter((file) => file.type === "blob")
        .filter((file) => {
            const parts = file.path.split("/");

            return !parts.some((part) =>
                IGNORED_DIRECTORIES.has(part),
            );
        })
        .filter((file) => {
            const extension = getExtension(file.path);

            return !IGNORED_EXTENSIONS.has(extension);
        })
        .filter(
            (file) =>
                file.size !== undefined &&
                file.size <= MAX_FILE_SIZE,
        )
        .slice(0, MAX_FILES);
}

function getExtension(path: string): string {
    const filename = path.split("/").pop() ?? "";
    const lastDot = filename.lastIndexOf(".");

    if (lastDot === -1) {
        return "";
    }

    return filename.slice(lastDot).toLowerCase();
}