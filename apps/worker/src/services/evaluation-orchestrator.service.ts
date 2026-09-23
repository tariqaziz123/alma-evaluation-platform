import { prisma } from "../lib/prisma.js";
import { SubmissionIngestionService } from "./submission-ingestion.service.js";
import { CriterionEvaluationService } from "./criterion-evaluation.service.js";
import { EvaluationScoringService } from "./evaluation-scoring.service.js";
import { EvaluationPersistenceService } from "./evaluation-persistence.service.js";
import type { CriterionEvaluation } from "../../../../packages/shared/src/evaluation/types.js";
import type { ProjectManifest } from "./project-analyzer.service.js";
import { HumanReviewService } from "./human-review.service.js";

export class EvaluationOrchestrator {
    private readonly ingestion: SubmissionIngestionService;
    private readonly criterionEvaluation: CriterionEvaluationService;
    private readonly scoring: EvaluationScoringService;
    private readonly persistence: EvaluationPersistenceService;
    private readonly humanReview = new HumanReviewService();

    constructor() {
        this.ingestion = new SubmissionIngestionService();
        this.criterionEvaluation = new CriterionEvaluationService();
        this.scoring = new EvaluationScoringService();
        this.persistence = new EvaluationPersistenceService();
    }

    async ingestSubmission(
        submissionId: string,
    ): Promise<void> {
        console.log(
            `[Orchestrator] Starting ingestion: ${submissionId}`,
        );

        const manifest = await this.ingestion.process(
            submissionId,
        );

        await prisma.submission.update({
            where: {
                id: submissionId,
            },
            data: {
                projectManifest: manifest,
                status: "UPLOADED",
            },
        });

        console.log(
            `[Orchestrator] Ingestion completed: ${submissionId}`,
        );
    }

    async evaluateForSubmission(
        submissionId: string,
    ): Promise<void> {
        const submission = await prisma.submission.findUnique({
            where: {
                id: submissionId,
            },
            include: {
                assignment: {
                    include: {
                        rubrics: {
                            orderBy: {
                                version: "desc",
                            },
                            take: 1,
                        },
                    },
                },
            },
        });

        if (!submission) {
            throw new Error(
                `Submission not found: ${submissionId}`,
            );
        }

        const rubric = submission.assignment.rubrics[0];

        if (!rubric) {
            throw new Error(
                `No rubric found for assignment: ${submission.assignmentId}`,
            );
        }

        const evaluationKey = `rubric:${rubric.id}`;

        let evaluationJob = await prisma.evaluationJob.findUnique({
            where: {
                submissionId_evaluationKey: {
                    submissionId,
                    evaluationKey,
                },
            },
        });

        if (!evaluationJob) {
            try {
                evaluationJob = await prisma.evaluationJob.create({
                    data: {
                        submissionId,
                        rubricId: rubric.id,
                        evaluationKey,
                        status: "PENDING",
                    },
                });

                console.log(
                    `[Orchestrator] Created evaluation job: ${evaluationJob.id}`,
                );
            } catch (error) {
                // Another worker may have created the same job concurrently.
                evaluationJob = await prisma.evaluationJob.findUnique({
                    where: {
                        submissionId_evaluationKey: {
                            submissionId,
                            evaluationKey,
                        },
                    },
                });

                if (!evaluationJob) {
                    throw error;
                }

                console.log(
                    `[Orchestrator] Reused concurrently created evaluation job: ${evaluationJob.id}`,
                );
            }
        } else {
            console.log(
                `[Orchestrator] Using existing evaluation job: ${evaluationJob.id}`,
            );
        }

        await this.evaluate(evaluationJob.id);
    }

    async evaluate(evaluationJobId: string): Promise<void> {
        const job = await prisma.evaluationJob.findUnique({
            where: {
                id: evaluationJobId,
            },
            include: {
                submission: {
                    include: {
                        artifacts: true,
                    },
                },
                rubric: {
                    include: {
                        criteria: true,
                    },
                },
            },
        });

        if (!job) {
            throw new Error(
                `Evaluation job not found: ${evaluationJobId}`,
            );
        }

        if (job.status === "COMPLETED") {
            console.log(
                `[Orchestrator] Evaluation already completed: ${evaluationJobId}`,
            );
            return;
        }

        await prisma.evaluationJob.update({
            where: {
                id: evaluationJobId,
            },
            data: {
                status: "PROCESSING",
                startedAt: new Date(),
            },
        });

        try {
            console.log(
                `[Orchestrator] Starting evaluation: ${evaluationJobId}`,
            );

            const evaluations: CriterionEvaluation[] = [];

            for (const criterion of job.rubric.criteria) {
                console.log(
                    `[Orchestrator] Evaluating criterion: ${criterion.name}`,
                );

                if (!job.submission.projectManifest) {
                    throw new Error(
                        `Project manifest not found for submission: ${job.submissionId}`,
                    );
                }

                const manifest = job.submission.projectManifest as ProjectManifest;
                const evaluation =
                    await this.criterionEvaluation.evaluate(
                        job.submissionId,
                        {
                            name: criterion.name,
                            description: criterion.description ?? undefined,
                        },
                        manifest,
                    );

                evaluations.push({
                    ...evaluation,
                    criterion: criterion.name,
                    maxScore: Number(criterion.maxScore),
                });
            }

            const scoringResult = this.scoring.calculate(
                job.rubric.criteria.map((criterion) => ({
                    name: criterion.name,
                    weight: Number(criterion.weight),
                    maxScore: Number(criterion.maxScore),
                })),
                evaluations,
            );

            console.log(
                `[Orchestrator] Score: ${scoringResult.totalScore}/${scoringResult.maxScore}`,
            );

            await this.persistence.save(
                evaluationJobId,
                {
                    summary: `Automated evaluation completed with score ${scoringResult.totalScore}/${scoringResult.maxScore}.`,
                    criteria: evaluations,
                },
            );

            const requiresHumanReview = evaluations.some((evaluation) => {
                const confidence = evaluation.confidence ?? 0;
                const evidenceCount = evaluation.evidence?.length ?? 0;

                return confidence < 0.7 || evidenceCount === 0;
            });

            if (requiresHumanReview) {
                await this.humanReview.requestReview(evaluationJobId);

                await prisma.submission.update({
                    where: {
                        id: job.submissionId,
                    },
                    data: {
                        status: "QUEUED",
                    },
                });

                console.log(
                    `[Orchestrator] Human review required for evaluation ${evaluationJobId}`,
                );

                return;
            }

            await prisma.evaluationJob.update({
                where: {
                    id: evaluationJobId,
                },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                },
            });

            await prisma.submission.update({
                where: {
                    id: job.submissionId,
                },
                data: {
                    status: "COMPLETED",
                },
            });

            console.log(
                `[Orchestrator] Evaluation completed: ${evaluationJobId}`,
            );
        } catch (error) {
            await prisma.evaluationJob.update({
                where: {
                    id: evaluationJobId,
                },
                data: {
                    status: "FAILED",
                },
            });

            await prisma.submission.update({
                where: {
                    id: job.submissionId,
                },
                data: {
                    status: "FAILED",
                },
            });

            throw error;
        }
    }
}