import type {
  Queue,
  SubmissionProcessingJob,
} from "./types.js";

export class LocalQueue implements Queue {
  private jobs: SubmissionProcessingJob[] = [];
  private handler:
    | ((job: SubmissionProcessingJob) => Promise<void>)
    | undefined;

  async publish(job: SubmissionProcessingJob): Promise<void> {
    this.jobs.push(job);

    console.log(`[Queue] Job published: ${job.jobId}`);

    await this.processNext();
  }

  async consume(
    handler: (job: SubmissionProcessingJob) => Promise<void>
  ): Promise<void> {
    this.handler = handler;
    await this.processNext();
  }

  private async processNext(): Promise<void> {
    if (!this.handler) {
      return;
    }

    const job = this.jobs.shift();

    if (!job) {
      return;
    }

    try {
      await this.handler(job);
    } catch (error) {
      console.error(`[Queue] Job failed: ${job.jobId}`, error);
    }
  }
}