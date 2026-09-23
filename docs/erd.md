# Entity Relationship Diagram

The platform uses PostgreSQL as the transactional source of truth. The following ER diagram shows the core relationships between users, courses, assignments, rubrics, submissions, evaluation jobs, evaluation results, and human review.

```text
┌──────────────┐
│    User      │
├──────────────┤
│ id PK        │
│ email        │
│ name         │
│ role         │
└──────┬───────┘
       │
       ├───────────────┐
       │               │
       │ 1:N           │ 1:N
       ▼               ▼
┌──────────────┐   ┌─────────────────┐
│ CourseMember │   │   Submission    │
├──────────────┤   ├─────────────────┤
│ id PK        │   │ id PK           │
│ courseId FK  │   │ assignmentId FK │
│ userId FK    │   │ studentId FK    │
└──────┬───────┘   │ status          │
       │           └───────┬─────────┘
       │                   │
       ▼                   │ 1:N
┌──────────────┐           ├───────────────┐
│    Course    │           │               │
├──────────────┤           ▼               ▼
│ id PK        │     ┌──────────────┐ ┌──────────────────┐
│ name         │     │  Submission  │ │  EvaluationJob   │
└──────┬───────┘     │   Artifact   │ ├──────────────────┤
       │             ├──────────────┤ │ id PK            │
       │ 1:N         │ id PK        │ │ submissionId FK  │
       ▼             │ submissionId │ │ rubricId FK     │
┌──────────────┐     │ type         │ │ status           │
│  Assignment  │     │ storageKey   │ │ evaluationKey   │
├──────────────┤     └──────────────┘ │ idempotencyKey  │
│ id PK        │                      └────────┬─────────┘
│ courseId FK  │                               │
│ title        │                               │ 1:N
└──────┬───────┘                               ▼
       │                              ┌──────────────────┐
       │ 1:N                          │ EvaluationAttempt│
       ▼                              ├──────────────────┤
┌──────────────┐                       │ id PK            │
│    Rubric    │                       │ evaluationJobId │
├──────────────┤                       │ attemptNumber   │
│ id PK        │                       │ status           │
│ assignmentId │                       └──────────────────┘
│ version      │
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────────┐
│ RubricCriterion  │
├──────────────────┤
│ id PK            │
│ rubricId FK      │
│ name             │
│ weight           │
│ maxScore         │
└────────┬─────────┘
         │
         │ 1:N
         ▼
┌──────────────────────────┐
│ EvaluationCriterionResult│
├──────────────────────────┤
│ id PK                    │
│ evaluationResultId FK   │
│ rubricCriterionId FK    │
│ score                    │
│ maxScore                 │
│ confidence               │
│ reasoning                │
│ evidence                 │
└──────────────────────────┘


EvaluationJob
      │
      │ 1:1
      ▼
┌──────────────────┐
│ EvaluationResult │
├──────────────────┤
│ id PK            │
│ evaluationJobId  │
│ totalScore       │
│ maxScore         │
│ summary          │
└──────────────────┘
      │
      │ 1:N
      ▼
EvaluationCriterionResult


EvaluationJob
      │
      │ 1:1
      ▼
┌──────────────────┐
│   HumanReview    │
├──────────────────┤
│ id PK            │
│ evaluationJobId  │
│ reviewerId FK    │
│ status           │
│ comments         │
│ finalScore       │
│ completedAt      │
└────────┬─────────┘
         │
         │ N:1
         ▼
       User


Submission
      │
      │ 1:N
      ▼
┌──────────────────┐
│ EvaluationChunk  │
├──────────────────┤
│ id PK            │
│ submissionId FK  │
│ filePath         │
│ chunkIndex       │
│ content          │
│ tokenEstimate    │
│ embedding        │
└──────────────────┘


User
  │
  │ 1:N
  ▼
┌──────────────────┐
│    AuditLog      │
├──────────────────┤
│ id PK            │
│ userId FK        │
│ action           │
│ entityType       │
│ entityId         │
│ metadata         │
│ createdAt        │
└──────────────────┘