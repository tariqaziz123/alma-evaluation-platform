export type SubmissionProcessingJob = {
  jobId: string;
  submissionId: string;
  artifactId: string;
};

export interface Queue {
  publish(job: SubmissionProcessingJob): Promise<void>;
  consume(
    handler: (job: SubmissionProcessingJob) => Promise<void>
  ): Promise<void>;
}