import { prisma } from "../lib/prisma.js";
import { RepositoryExtractor } from "./repository-extractor.service.js";
import {
  ProjectAnalyzer,
  type ProjectManifest,
} from "./project-analyzer.service.js";
import { EvaluationContextService } from "./evaluation-context.service.js";
import { ContentChunker } from "./content-chunker.service.js";
import { VectorStoreService } from "./vector-store.service.js";
import { MockEmbeddingProvider } from "./embedding/mock-embedding.provider.js";

export class SubmissionIngestionService {
  private readonly repositoryExtractor: RepositoryExtractor;
  private readonly projectAnalyzer: ProjectAnalyzer;
  private readonly evaluationContext: EvaluationContextService;
  private readonly chunker: ContentChunker;
  private readonly vectorStore: VectorStoreService;
  private readonly embeddingProvider: MockEmbeddingProvider;

  constructor() {
    this.repositoryExtractor = new RepositoryExtractor(
      process.env.GITHUB_TOKEN,
    );
    this.projectAnalyzer = new ProjectAnalyzer();
    this.evaluationContext = new EvaluationContextService();
    this.chunker = new ContentChunker();
    this.vectorStore = new VectorStoreService();
    this.embeddingProvider = new MockEmbeddingProvider();
  }

  async process(submissionId: string): Promise<ProjectManifest> {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        artifacts: true,
      },
    });

    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const artifact = submission.artifacts.find(
      (item) => item.type === "GITHUB",
    );

    if (!artifact?.sourceUrl) {
      throw new Error(
        `GitHub source URL not found for submission: ${submissionId}`,
      );
    }

    console.log(
      `[Ingestion] Extracting repository for ${submissionId}`,
    );

    const project = await this.repositoryExtractor.extract(
      artifact.sourceUrl,
    );

    console.log(
      `[Ingestion] Extracted ${project.files.length} files`,
    );

    const manifest = this.projectAnalyzer.analyze(project.files);

    console.log(
      `[Ingestion] Project: ${manifest.projectName}`,
    );

    const context = this.evaluationContext.build(
      manifest,
      project.files,
    );

    console.log(
      `[Ingestion] Relevant files: ${context.relevantFiles.length}`,
    );

    // Make ingestion retry-safe.
    await prisma.evaluationChunk.deleteMany({
      where: {
        submissionId,
      },
    });

    let totalChunks = 0;

    // Index all extracted text files so semantic retrieval
    // can discover evidence beyond the initially selected files.
    for (const file of project.files) {
      const chunks = this.chunker.chunk(
        file.path,
        file.content,
      );

      for (const chunk of chunks) {
        const created = await prisma.evaluationChunk.create({
          data: {
            submissionId,
            filePath: chunk.filePath,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenEstimate: chunk.estimatedTokens,
          },
        });

        const embedding =
          await this.embeddingProvider.embed(chunk.content);

        await this.vectorStore.saveEmbedding(
          created.id,
          embedding,
        );

        totalChunks++;
      }
    }

    console.log(
      `[Ingestion] Stored ${totalChunks} embedded chunks`,
    );

    return manifest;
  }
}