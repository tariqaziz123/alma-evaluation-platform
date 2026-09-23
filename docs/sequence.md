# Evaluation Platform — Sequence & Lifecycle

## 1. Overview

The evaluation platform processes student project submissions asynchronously.

The core lifecycle is:

Student Submission
→ Submission Processing
→ File / Repository Extraction
→ Project Understanding
→ AI Evaluation
→ Rubric-Based Scoring
→ Human Review if Required
→ Final Evaluation
→ Student Dashboard

The system uses PostgreSQL as the source of truth for workflow state and an asynchronous queue for long-running processing.

---

# 2. Submission Processing Flow

## 2.1 High-Level Flow

```
Student
   |
   | POST /api/v1/submissions
   v
API
   |
   | Create Submission + Artifact
   v
PostgreSQL
   |
   | Publish ingestion job
   v
SQS / Redis Queue
   |
   v
Worker
   |
   | Extract repository / files
   v
Submission Processor
   |
   | Build project manifest
   | Create chunks
   | Generate embeddings
   v
PostgreSQL + pgvector
   |
   v
Submission READY
```

The API does not perform heavy file processing synchronously.

This prevents long-running extraction and AI processing from blocking HTTP requests.

---

# 3. Submission Lifecycle

A submission follows the following state transitions:

```
DRAFT
  |
  v
UPLOADED
  |
  v
QUEUED
  |
  v
PROCESSING
  |
  +------------------+
  |                  |
  v                  v
READY              FAILED
  |                  |
  |                  |
  |                  +----> retry
  |                         |
  |                         v
  |                       QUEUED
  |
  v
EVALUATING
  |
  +----------------------------+
  |                            |
  v                            v
COMPLETED                 HUMAN_REVIEW
                               |
                +--------------+--------------+
                |                             |
                v                             v
             APPROVED                      REJECTED
                |                             |
                v                             |
            COMPLETED <-----------------------+
                                              |
                                              v
                                           QUEUED
```

The exact database state is controlled by the application and workers rather than inferred from queue messages.

---

# 4. Evaluation Creation Flow

When an instructor or authorized system requests an evaluation:

```
Client
  |
  | POST /api/v1/evaluations
  | Idempotency-Key: evaluation-123
  v
API
  |
  | Validate request
  v
PostgreSQL
  |
  +--> Verify submission
  |
  +--> Verify rubric
  |
  +--> Check existing evaluation
  |
  +--> Create EvaluationJob
  |
  v
QUEUED
  |
  | Publish evaluation job
  v
Queue
  |
  v
Evaluation Worker
```

The API returns `202 Accepted` because evaluation is asynchronous.

Example response:

```
{
  "id": "evaluation-job-id",
  "status": "QUEUED"
}
```

The client can later retrieve the evaluation status.

---

# 5. Evaluation Worker Flow

The worker performs the long-running evaluation process.

```
Queue
  |
  | Evaluation Job
  v
Evaluation Worker
  |
  v
Load Submission
  |
  v
Load EvaluationJob
  |
  v
Create EvaluationAttempt
  |
  v
Load Rubric
  |
  v
Retrieve Project Context
  |
  v
Retrieve Relevant Chunks
  |
  v
Criterion Evaluation
  |
  v
Structured AI Output
  |
  v
Validate Scores
  |
  v
Persist EvaluationResult
  |
  +----------------------+
  |                      |
  | High confidence      | Low confidence /
  | + evidence            | insufficient evidence
  v                      v
COMPLETED            HUMAN_REVIEW
```

---

# 6. AI Evaluation Pipeline

The AI pipeline is intentionally divided into multiple stages.

```
Submission
   |
   v
Project Manifest
   |
   v
File Classification
   |
   v
Chunking
   |
   v
Embeddings
   |
   v
pgvector
   |
   v
Rubric-Aware Retrieval
   |
   v
Criterion Evaluator
   |
   v
Structured Evaluation
   |
   v
Deterministic Score Aggregation
   |
   v
EvaluationResult
```

Each rubric criterion is evaluated independently where practical.

This allows the platform to:

* provide criterion-level evidence
* store confidence values
* identify weak evaluations
* retry individual processing stages where appropriate
* support human review

---

# 7. RAG / Retrieval Flow

The platform uses retrieval to avoid sending the entire project to the LLM for every criterion.

```
Project Files
     |
     v
  Chunking
     |
     v
Text Chunks
     |
     v
Embedding Model
     |
     v
  Vectors
     |
     v
  pgvector
     |
     |
Rubric Criterion
     |
     v
Query Embedding
     |
     v
Similarity Search
     |
     v
Top Relevant Chunks
     |
     v
LLM Evaluation
```

Example:

```
Criterion:
"Evaluate code quality."
```

The retrieval layer may select:

```
src/components/*
src/hooks/*
src/services/*
package.json
test files
```

instead of sending unrelated documentation or generated files.

---

# 8. Rubric-Based Evaluation

Rubrics are data-driven rather than hard-coded.

Example:

```
Functionality       25
Code Quality        20
Architecture        20
Problem Solving     15
Documentation       10
Innovation / AI     10
```

Total:

```
100
```

The evaluation pipeline loads the active rubric from PostgreSQL.

The evaluator then produces a criterion-level result:

```
{
  "criterion": "Code Quality",
  "score": 16,
  "maxScore": 20,
  "confidence": 0.91,
  "evidence": [
    "Reusable React components",
    "Typed service interfaces",
    "Automated tests"
  ]
}
```

The final score is calculated from the structured criterion results rather than allowing the LLM to directly determine the final total.

This provides deterministic score aggregation.

---

# 9. Human Review Flow

Human review is triggered when automated evaluation does not meet configured confidence or evidence requirements.

Example trigger:

```
confidence < 0.70
```

or:

```
evidence is missing
```

or:

```
evaluation output fails validation
```

Flow:

```
AI Evaluation
     |
     v
Confidence / Evidence Check
     |
     +----------------------+
     |                      |
     v                      v
  Sufficient            Insufficient
     |                      |
     v                      v
COMPLETED              HUMAN_REVIEW
                            |
                            v
                     Review Requested
                            |
                            v
                     Instructor/Admin
                            |
                            v
                        Claim Review
                            |
                            v
                     Review Evaluation
                            |
                +-----------+-----------+
                |                       |
                v                       v
             APPROVE                 REJECT
                |                       |
                v                       v
            COMPLETED               QUEUED
                                        |
                                        v
                               Automated Evaluation
```

---

# 10. Human Review Claim Flow

A review starts with:

```
status = REQUESTED
reviewerId = null
```

A reviewer claims it:

```
REQUESTED
    |
    | claim
    v
IN_PROGRESS
    |
    | reviewerId assigned
    v
Reviewer owns review
```

The claim operation uses a conditional database update so two reviewers cannot successfully claim the same review concurrently.

Conceptually:

```
UPDATE HumanReview
SET status = 'IN_PROGRESS',
    reviewerId = '<reviewer>'
WHERE id = '<review-id>'
  AND status = 'REQUESTED'
  AND reviewerId IS NULL
```

If no row is updated, another reviewer already claimed the review or the review is no longer claimable.

---

# 11. Human Review Approval

When the reviewer approves:

```
HumanReview
    |
    v
APPROVED
    |
    v
EvaluationJob
    |
    v
COMPLETED
    |
    v
Submission
    |
    v
COMPLETED
```

An audit event is also recorded.

Example:

```
HUMAN_REVIEW_APPROVED
```

The final review decision becomes part of the evaluation lifecycle.

---

# 12. Human Review Rejection

When the reviewer rejects an evaluation:

```
HumanReview
    |
    v
REJECTED
    |
    v
EvaluationJob
    |
    v
QUEUED
    |
    v
Evaluation Worker
    |
    v
New EvaluationAttempt
```

The system does not create an entirely new submission.

Instead, the existing evaluation job can be reprocessed.

This preserves evaluation history and keeps the workflow associated with the same submission.

---

# 13. Evaluation Attempt Lifecycle

Every automated evaluation creates an `EvaluationAttempt`.

Example:

```
Attempt 1
   |
   v
RUNNING
   |
   +------> SUCCEEDED
   |
   +------> FAILED
   |
   +------> TIMED_OUT
```

If an evaluation is retried:

```
Attempt 1 -> FAILED
               |
               v
            Attempt 2
               |
               v
            RUNNING
               |
               v
            SUCCEEDED
```

This provides a durable record of evaluation execution.

---

# 14. Failure and Retry Flow

A worker failure should not directly corrupt the submission state.

Production queue behavior:

```
Queue
  |
  v
Worker
  |
  v
Processing
  |
  +---- success ----> ACK
  |
  +---- failure ----> message becomes visible again
                          |
                          v
                       Retry
                          |
                          v
                     Max Attempts?
                       /       \
                     No         Yes
                     |           |
                     v           v
                  Retry        DLQ
                                 |
                                 v
                            Human Review /
                            Operational Alert
```

SQS visibility timeout prevents a worker failure from permanently removing a job.

The PoC uses Redis for simplicity. Redis `BRPOP` removes a message immediately, so the production design uses SQS with visibility timeout and DLQ semantics.

---

# 15. Idempotent Evaluation Creation

Evaluation creation supports an idempotency key.

Example request:

```
POST /api/v1/evaluations

Idempotency-Key:
evaluation-2026-001
```

If the same request is accidentally submitted multiple times:

```
Request 1
   |
   v
EvaluationJob created

Request 2
   |
   v
Same submission + idempotency key
   |
   v
Existing job returned
```

This prevents duplicate evaluation jobs caused by:

* browser retries
* network retries
* client timeouts
* user double-clicks
* API gateway retries

The database uniqueness constraint provides the final concurrency protection.

---

# 16. Evaluation Job State Machine

The evaluation job lifecycle is:

```
PENDING
  |
  v
QUEUED
  |
  v
PROCESSING / EVALUATING
  |
  +--------------------+
  |                    |
  v                    v
COMPLETED          HUMAN_REVIEW
                       |
                +------+------+
                |             |
                v             v
             APPROVED      REJECTED
                |             |
                v             v
            COMPLETED       QUEUED
                              |
                              v
                           EVALUATING
```

A failed automated attempt can transition to:

```
FAILED
  |
  | retry
  v
QUEUED
```

After the retry limit is exceeded, the message moves to the DLQ and requires operational or human intervention.

---

# 17. API Request / Worker Separation

The API is responsible for:

* authentication and authorization
* request validation
* database writes
* idempotency
* queue publishing
* returning status to clients

The worker is responsible for:

* repository/file extraction
* project understanding
* chunking
* embeddings
* retrieval
* LLM calls
* scoring
* evaluation persistence
* human-review triggering

This separation prevents expensive AI workloads from consuming API capacity.

---

# 18. Submission Ingestion Sequence

```
Client
  |
  | Upload / submission metadata
  v
API
  |
  +----> PostgreSQL
  |       |
  |       +---- Submission
  |       +---- Artifact
  |
  +----> Object Storage
  |
  +----> Queue
            |
            v
          Worker
            |
            v
      Download Artifact
            |
            v
      Security Validation
            |
            v
      Extract Files
            |
            v
      Classify Files
            |
            v
      Build Manifest
            |
            v
      Create Chunks
            |
            v
      Generate Embeddings
            |
            v
      Save pgvector Data
            |
            v
         READY
```

---

# 19. GitHub Repository Submission

For GitHub-based submissions:

```
Student
   |
   | GitHub repository URL
   v
API
   |
   v
Submission Artifact
   |
   v
Queue
   |
   v
Worker
   |
   v
GitHub API
   |
   v
Repository Files
   |
   v
File Filtering
   |
   v
Project Manifest
   |
   v
Chunking + Embeddings
   |
   v
Evaluation
```

The GitHub API is used instead of allowing the evaluation worker to execute arbitrary repository code.

The evaluator analyzes source files and metadata without trusting repository instructions.

---

# 20. Security Boundary During Evaluation

Student project content is untrusted input.

The evaluation pipeline treats:

```
README
source code
comments
configuration files
documentation
repository metadata
```

as evidence only.

They are not trusted system instructions.

Conceptually:

```
System Prompt
     |
     | Trusted
     v
Evaluation Instructions
     |
     v
Untrusted Project Content
     |
     v
LLM
```

Project content must never be allowed to override system-level evaluation instructions.

Potential prompt injection content is treated as project data rather than executable instructions.

---

# 21. Database as Source of Truth

The database owns durable workflow state.

For example:

```
EvaluationJob.status = QUEUED
```

means the application considers the evaluation queued.

The queue provides delivery and asynchronous execution.

Therefore:

```
Database = workflow truth

Queue = work delivery mechanism

Worker = execution mechanism
```

This separation allows workers to restart without losing the authoritative evaluation state.

---

# 22. Queue and Database Consistency

Publishing a queue message and updating a database are separate operations.

For the PoC:

```
Database Transaction
      |
      +---- update state
      |
      +---- publish queue message
```

For production, an Outbox Pattern is recommended:

```
API Transaction
      |
      +---- Update Business Data
      |
      +---- Insert Outbox Event
                |
                v
          Outbox Publisher
                |
                v
              SQS
```

This avoids a dual-write problem where the database update succeeds but queue publishing fails, or vice versa.

---

# 23. Scaling Flow

At higher volumes:

```
API
  |
  v
Load Balancer
  |
  +--------+--------+
  |        |        |
API-1    API-2    API-3
  |
  v
SQS
  |
  +--------+--------+--------+
  |        |        |        |
Worker   Worker   Worker   Worker
  |        |        |        |
  +--------+--------+--------+
           |
           v
    PostgreSQL / pgvector
           |
           v
    Object Storage / LLM APIs
```

Workers scale horizontally according to:

* queue depth
* oldest message age
* CPU utilization
* memory utilization
* evaluation latency

The architecture does not require a fixed number of workers.

---

# 24. 10,000 Submissions Per Day

10,000 submissions/day corresponds approximately to:

```
417 submissions/hour
6.9 submissions/minute
0.116 submissions/second average
```

The average rate is relatively low, but production capacity should account for burst traffic.

For example, a large assignment deadline could produce many submissions within a short period.

The queue absorbs this burst.

Instead of requiring the API to synchronously process every submission:

```
Large Burst
    |
    v
  SQS
    |
    v
Queue Backlog
    |
    v
Auto-scaled Workers
    |
    v
Completed Evaluations
```

This allows ingestion and evaluation throughput to scale independently.

---

# 25. Evaluation Latency

An individual evaluation may take approximately 2–15 minutes because it can involve:

* repository extraction
* file classification
* chunking
* embeddings
* multiple retrieval operations
* multiple LLM calls
* score validation
* persistence

Therefore evaluation must not be implemented as a synchronous HTTP request.

The client should use:

```
POST /evaluations
      |
      v
  202 Accepted
      |
      v
GET /evaluations/:id
```

or a future event/websocket mechanism for status updates.

---

# 26. Student Dashboard Flow

The student dashboard reads durable state from the API.

```
Student Dashboard
      |
      | GET evaluation
      v
     API
      |
      v
  PostgreSQL
      |
      v
Evaluation Result
      |
      v
Criterion Results
      |
      v
Evidence + Feedback
```

The dashboard should not read directly from the queue.

The queue is an internal processing mechanism.

---

# 27. Instructor Review Dashboard Flow

```
Instructor
    |
    v
Review Dashboard
    |
    | GET pending reviews
    v
   API
    |
    v
HumanReview
    |
    v
Review Details
    |
    +---- AI score
    +---- Criterion scores
    +---- Evidence
    +---- Project information
    |
    v
Claim Review
    |
    v
Approve / Reject
    |
    v
Evaluation Lifecycle
```

All review actions are recorded in `AuditLog`.

---

# 28. Observability Flow

The production system should provide tracing and metrics across the entire asynchronous pipeline.

```
API Request
    |
    v
EvaluationJob
    |
    v
Queue Message
    |
    v
Worker
    |
    v
LLM Calls
    |
    v
Database
```

Important metrics include:

* evaluation duration
* queue depth
* queue age
* worker failure rate
* retry count
* DLQ message count
* LLM latency
* LLM error rate
* token usage
* human-review rate
* average confidence
* evaluation completion rate

OpenTelemetry can connect API and worker traces using correlation IDs.

CloudWatch can provide production metrics, logs, and alarms.

---

# 29. Complete End-to-End Sequence

The complete happy-path flow is:

```
Student
   |
   | Submit Project
   v
API
   |
   +--------------------+
   |                    |
   v                    v
PostgreSQL          Object Storage
   |
   v
Queue
   |
   v
Ingestion Worker
   |
   v
Extract + Understand Project
   |
   v
Chunk + Embed
   |
   v
pgvector
   |
   v
Submission READY
   |
   v
Evaluation Request
   |
   v
EvaluationJob QUEUED
   |
   v
Evaluation Queue
   |
   v
Evaluation Worker
   |
   v
Retrieve Relevant Context
   |
   v
Rubric Criteria
   |
   v
LLM Evaluation
   |
   v
Validate Structured Output
   |
   v
Calculate Scores
   |
   v
Confidence / Evidence Check
   |
   +-------------------------+
   |                         |
   v                         v
High Confidence          Low Confidence
   |                         |
   v                         v
COMPLETED               HUMAN_REVIEW
                             |
                             v
                        Instructor
                             |
                      +------+------+
                      |             |
                      v             v
                   APPROVE       REJECT
                      |             |
                      v             v
                  COMPLETED       QUEUED
                                    |
                                    v
                               Re-evaluation
```

---

# 30. Failure-Aware End-to-End Sequence

Production behavior when failures occur:

```
Submission
   |
   v
Queue
   |
   v
Worker
   |
   +---- Worker Crash
   |        |
   |        v
   |     Visibility Timeout
   |        |
   |        v
   |      Retry
   |
   +---- LLM Failure
   |        |
   |        v
   |      Retry
   |
   +---- Validation Failure
   |        |
   |        v
   |      Retry / Review
   |
   +---- Repeated Failure
            |
            v
           DLQ
            |
            v
     Operational Alert
            |
            v
       Manual Review
```

This allows transient failures to recover automatically while persistent failures become visible to operators.

---

# 31. Design Principles

The sequence design follows these principles:

1. HTTP requests remain short-lived.
2. Long-running work is asynchronous.
3. PostgreSQL is the durable source of truth.
4. Queue messages represent work, not permanent state.
5. Workers are horizontally scalable.
6. Evaluation attempts are recorded independently.
7. Idempotency prevents duplicate evaluations.
8. Rubrics are configurable data.
9. AI output is structured and validated.
10. Project content is treated as untrusted input.
11. Low-confidence evaluations can enter human review.
12. Failed jobs can retry without creating duplicate submissions.
13. DLQs capture repeatedly failing messages.
14. Production queue processing uses visibility timeout and dead-letter handling.
15. Production database/queue consistency can use the Outbox Pattern.
16. Audit logs preserve important human-review actions.

---

# 32. Summary

The platform uses an asynchronous, state-driven workflow to separate submission ingestion, project understanding, AI evaluation, scoring, and human review.

The central execution model is:

```
API
  |
  v
PostgreSQL
  |
  v
Queue
  |
  v
Worker
  |
  v
AI Evaluation
  |
  +----> COMPLETED
  |
  +----> HUMAN_REVIEW
  |
  +----> RETRY
  |
  +----> DLQ
```

This model allows the platform to begin with approximately 30 submissions per day while providing a clear scaling path toward 10,000 submissions per day without redesigning the core workflow.
