import { RepositoryExtractor } from "./services/repository-extractor.service.js";

async function main() {
  const extractor = new RepositoryExtractor();

  const project = await extractor.extract(
    "https://github.com/octocat/Hello-World",
  );

  console.log(`Repository: ${project.owner}/${project.repository}`);
  console.log(`Branch: ${project.defaultBranch}`);
  console.log(`Files extracted: ${project.files.length}`);

  for (const file of project.files) {
    console.log(`\n--- ${file.path} (${file.size} bytes) ---`);
    console.log(file.content);
  }
}

main().catch((error) => {
  console.error("Repository extraction failed:", error);
  process.exitCode = 1;
});