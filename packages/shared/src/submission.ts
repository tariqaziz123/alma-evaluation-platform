export type SubmissionSource =
  | "GITHUB"
  | "ZIP"
  | "PDF"
  | "GOOGLE_DRIVE"
  | "VIDEO"
  | "DOCUMENT"
  | "LIVE_URL";

export interface CreateSubmissionInput {
  assignmentId: string;
  studentId: string;
  sourceType: SubmissionSource;
  sourceUrl?: string;
}
