import type { ExtractedProject } from "./repository-extractor.service.js";

export interface SubmissionExtractor {
  supports(sourceType: string): boolean;

  extract(sourceUrl: string): Promise<ExtractedProject>;
}