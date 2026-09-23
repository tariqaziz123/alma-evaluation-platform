# AI-Powered Project Evaluation Platform

An AI-powered backend platform for evaluating student software projects against configurable rubrics.

The platform accepts project submissions such as GitHub repositories, documents, ZIP archives, videos, and live applications, processes them asynchronously, extracts relevant project evidence, evaluates the evidence using LLM-assisted criteria evaluation, calculates deterministic scores, and supports human review when automated confidence is insufficient.

This repository was developed as part of the **AlmaBetter SDE III Backend Architecture Assignment**.

---

## 1. Overview

The platform is designed around four core principles:

* **PostgreSQL owns workflow state and transactional data**
* **A queue owns asynchronous job delivery**
* **Workers own ingestion and evaluation processing**
* **The LLM provides evaluation intelligence, not final business-state ownership**

The architecture separates API/orchestration from long-running ingestion and evaluation work so that the API remains responsive while workers can scale independently.

### High-level flow

```text
Student / Instructor / Admin
            |
            v
      Frontend / Client
            |
            v
       ALB / NGINX
            |
            v
 Node.js + TypeScript API
            |
      +-----+-----+
      |           |
      v           v
 PostgreSQL     Redis
      |       Cache / Rate Limit
      |
      v
   Queue
      |
      v
 Worker Fleet
      |
      +------------------+
      |                  |
      v                  v
Project Ingestion    Evaluation
      |                  |
      v                  v
File Analysis       LLM Evaluation
      |                  |
      v                  v
Chunking + Vector    Deterministic
Retrieval            Scoring
      |                  |
      +--------+---------+
               |
               v
        Evaluation Result
               |
        +------+------+
        |             |
        v             v
   COMPLETED      HUMAN REVIEW
```

---

## 2. Key Features

### Submission processing

* Submission creation
* Artifact tracking
* GitHub repository ingestion
* Source-specific extractor abstraction
* Project manifest generation
* Relevant-file analysis
* Content chunking
* Token estimation
* Embedding/vector storage
* Rubric-based evaluation
* Criterion-level scoring
* Evidence collection
* Confidence scoring
* Deterministic score aggregation
* Human review workflow
* Evaluation retry/failure states
* Audit logging

### Production architecture

The production design additionally supports:

* AWS S3 for artifact storage
* Amazon SQS + Dead Letter Queue
* ECS/Fargate worker fleet
* ALB/NGINX
* OpenAI / AWS Bedrock through an LLM abstraction
* PostgreSQL + pgvector
* Redis/Valkey
* CloudWatch + OpenTelemetry
* GitHub API
* Transactional outbox
* Horizontal worker scaling
* Production authentication and RBAC
* Security controls for uploaded artifacts

---

## 3. Technology Stack

| Area                        | Technology                                    |
| --------------------------- | --------------------------------------------- |
| Runtime                     | Node.js                                       |
| Language                    | TypeScript                                    |
| API                         | Express                                       |
| ORM                         | Prisma                                        |
| Database                    | PostgreSQL                                    |
| Vector Search               | pgvector                                      |
| Queue - PoC                 | Redis                                         |
| Queue - Production          | Amazon SQS + DLQ                              |
| Cache / Coordination        | Redis / Valkey                                |
| Object Storage - Production | Amazon S3                                     |
| Compute - Production        | AWS ECS / Fargate                             |
| Load Balancing              | ALB / NGINX                                   |
| AI/LLM                      | Provider abstraction for OpenAI / AWS Bedrock |
| External Integration        | GitHub API                                    |
| Validation                  | Zod                                           |
| Containerization            | Docker / Docker Compose                       |
| CI/CD                       | GitHub Actions                                |
| Observability               | CloudWatch + OpenTelemetry                    |
| Testing direction           | Jest / integration testing roadmap            |

---

## 4. Repository Structure

```text
alma-evaluation-platform/
│
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── routes/
│   │       ├── services/
│   │       ├── lib/
│   │       └── server.ts
│   │
│   └── worker/
│       └── src/
│           ├── services/
│           └── worker.ts
│
├── packages/
│   └── shared/
│       └── src/
│           ├── evaluation/
│           └── queue/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docs/
│   ├── architecture.md
│   ├── sequence.md
│   ├── ai-evaluation.md
│   ├── api-design.md
│   ├── erd.md
│   ├── reliability-and-scaling.md
│   └── technical-decisions.md
│
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── prisma.config.ts
└── README.md
```

---

## 5. Architecture Documentation

Detailed architecture documentation is available in the `docs/` directory.

### System architecture

See:

```text
docs/architecture.md
```

Covers:

* Application components
* API architecture
* Database
* Object storage
* Queue
* Workers
* AI/LLM services
* Vector search
* Human review
* Observability
* External integrations
* Production vs PoC architecture

### Submission processing sequence

See:

```text
docs/sequence.md
```

Covers the end-to-end lifecycle from submission creation through ingestion, evaluation, persistence, notification, and human review.

### AI / LLM architecture

See:

```text
docs/ai-evaluation.md
```

Covers:

* File classification
* Project context
* Chunking
* Summarization
* Embeddings
* pgvector
* RAG
* Rubric-aware retrieval
* Structured LLM output
* Deterministic scoring
* Confidence thresholds
* Human-in-the-loop evaluation
* Prompt injection considerations

### API design

See:

```text
docs/api-design.md
```

Covers:

* Create Submission
* Get Submission
* Upload Submission
* Start Evaluation
* Get Evaluation Status
* Get Evaluation Result
* Update Rubric
* Request Human Review
* Approve / Reject Review

### Database / ERD

See:

```text
docs/erd.md
```

The database models include:

* Users
* Courses
* Course Members
* Assignments
* Rubrics
* Rubric Criteria
* Submissions
* Submission Artifacts
* Evaluation Jobs
* Evaluation Attempts
* Evaluation Results
* Criterion Results
* Evaluation Chunks
* Human Reviews
* Audit Logs

### Reliability and scaling

See:

```text
docs/reliability-and-scaling.md
```

Covers:

* Worker failures
* Queue retries
* Dead-letter queues
* LLM failures
* Rate limits
* Timeouts
* Idempotency
* Duplicate processing
* Backpressure
* Horizontal scaling
* 10,000 submissions/day design

### Technical decisions

See:

```text
docs/technical-decisions.md
```

Documents architectural choices and alternatives including:

* PostgreSQL vs MongoDB
* SQS vs RabbitMQ vs Kafka
* Hosted LLM vs self-hosted models
* pgvector vs dedicated vector databases
* ECS/Fargate vs EC2/serverless approaches

---

## 6. PoC vs Production Architecture

The repository intentionally distinguishes between the implemented proof of concept and the production architecture.

### Implemented PoC

The current PoC demonstrates:

```text
Node.js + TypeScript API
        |
        v
PostgreSQL + Prisma
        |
        v
Redis Queue
        |
        v
Worker
        |
        v
GitHub Ingestion
        |
        v
Project Analysis
        |
        v
Relevant File Identification
        |
        v
Chunking
        |
        v
pgvector
        |
        v
Rubric Evaluation
        |
        v
Deterministic Scoring
        |
        v
Human Review
```

### Production target

The production architecture evolves this into:

```text
Client
  |
  v
ALB / NGINX
  |
  v
ECS/Fargate API
  |
  +---- PostgreSQL
  |
  +---- Redis / Valkey
  |
  +---- S3
  |
  +---- SQS + DLQ
             |
             v
       ECS/Fargate Workers
             |
             +---- GitHub API
             |
             +---- Secure Extraction
             |
             +---- Project Analysis
             |
             +---- pgvector
             |
             +---- LLM Provider
             |
             v
       Evaluation Result
             |
             v
       Human Review
```

The PoC does not claim to be a production deployment.

---

## 7. Local Development

### Prerequisites

Install:

* Node.js 20+
* npm
* Docker Desktop
* Git

Node.js 24 was used during development.

---

## 8. Install Dependencies

Clone the repository and install dependencies:

```bash
npm install
```

---

## 9. Environment Variables

Create a `.env` file in the repository root.

Example:

```env
DATABASE_URL="postgresql://alma:alma_dev_password@localhost:5432/alma_evaluation"
SHADOW_DATABASE_URL="postgresql://alma:alma_shadow@localhost:5432/alma_shadow"

REDIS_URL="redis://localhost:6379"

GITHUB_TOKEN="your_github_token"
```

### Environment variable notes

* `DATABASE_URL` points to the local PostgreSQL database.
* `SHADOW_DATABASE_URL` is used by Prisma migrations.
* `REDIS_URL` points to the local Redis instance.
* `GITHUB_TOKEN` is used by the GitHub ingestion PoC when repository access requires authentication.

Do not commit real secrets to Git.

---

## 10. Start PostgreSQL and Redis

The local development environment uses Docker Compose.

Run:

```bash
docker compose up -d
```

Check the services:

```bash
docker compose ps
```

Expected services:

```text
alma-postgres
alma-redis
```

PostgreSQL is exposed on:

```text
localhost:5432
```

Redis is exposed on:

```text
localhost:6379
```

---

## 11. PostgreSQL + pgvector

The PostgreSQL container uses:

```text
pgvector/pgvector:pg16
```

The PoC uses pgvector for storing and querying project embeddings.

Verify PostgreSQL is running:

```bash
docker exec alma-postgres pg_isready -U alma -d alma_evaluation
```

The project has also been validated with pgvector enabled.

---

## 12. Prisma

Generate the Prisma client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate deploy
```

For local development where migration creation is required:

```bash
npx prisma migrate dev
```

**Do not run `prisma migrate reset` on the existing development database**, because it deletes existing data.

---

## 13. TypeScript Validation

Run:

```bash
npx tsc --noEmit
```

The project currently passes TypeScript validation without compilation errors.

---

## 14. Run the API

Start the API:

```bash
npm run dev:api
```

The API runs through:

```text
apps/api/src/server.ts
```

---

## 15. Run the Worker

In another terminal:

```bash
npm run dev:worker
```

The worker is responsible for long-running ingestion and evaluation processing.

---

## 16. Submission Processing PoC

The current implemented ingestion path supports GitHub repositories.

The flow is:

```text
Submission
    |
    v
GitHub Repository
    |
    v
Repository Metadata
    |
    v
Repository Tree
    |
    v
File Filtering
    |
    v
File Content Extraction
    |
    v
Project Manifest
    |
    v
Relevant File Analysis
    |
    v
Content Chunking
    |
    v
Embedding Generation
    |
    v
pgvector Storage
```

The code uses a source extractor abstraction so additional submission types can be introduced without coupling the evaluation engine to a specific source.

Currently implemented:

```text
GITHUB
```

Production roadmap:

```text
GITHUB
ZIP
PDF
DOCUMENT
VIDEO
GOOGLE_DRIVE
LIVE_URL
```

---

## 17. Multiple Artifacts

A submission can contain multiple artifacts, for example:

```text
Submission
    |
    +-- GitHub → Repository Extractor
    |
    +-- ZIP → Archive Extractor
    |
    +-- PDF → Document Extractor
    |
    +-- Video → Transcript / Frame Extractor
    |
    +-- Live URL → Isolated URL Evaluator
    |
    +-- Google Drive → Drive Connector
```

Each artifact is represented by `SubmissionArtifact` and can be processed using a source-specific extractor.

The evaluation layer can combine successfully processed artifacts into the project context used for rubric-based evaluation.

The GitHub ingestion path is implemented in the PoC. Other extractors are part of the production roadmap.

---

## 18. Evaluation Pipeline

The evaluation architecture follows:

```text
Artifact
   |
   v
Secure Ingestion
   |
   v
File Classification
   |
   v
Project Manifest
   |
   v
Relevant Evidence
   |
   v
Chunking / Summarization
   |
   v
Embeddings
   |
   v
Vector Retrieval
   |
   v
Rubric-aware Context
   |
   v
LLM Criterion Evaluation
   |
   v
Structured Output
   |
   v
Deterministic Scoring
   |
   v
Evaluation Result
   |
   +----------------------+
   |                      |
   v                      v
COMPLETED             HUMAN REVIEW
```

The LLM is responsible for interpreting project evidence against rubric criteria.

The deterministic scoring layer is responsible for calculating final scores from the criterion-level results.

This separation prevents the LLM from directly controlling workflow state or final aggregation logic.

---

## 19. Human-in-the-Loop Evaluation

Automated evaluation can request human review when:

* Confidence is below the configured threshold
* Required evidence is missing
* Evaluation output is ambiguous
* The evaluation requires instructor judgment

The workflow is:

```text
Automated Evaluation
        |
        v
Confidence / Evidence Check
        |
   +----+----+
   |         |
   v         v
Sufficient   Insufficient
   |         |
   v         v
Completed  Human Review
             |
        +----+----+
        |         |
        v         v
     Approve    Reject
        |         |
        +----+----+
             |
             v
        Final Result
```

Human review actions are recorded in the database and can be included in the audit trail.

---

## 20. Reliability and Idempotency

The production queue uses Amazon SQS with at-least-once delivery semantics.

Workers therefore must be idempotent.

The design uses:

```text
Submission ID
+
Evaluation Key
+
Idempotency Key
```

to prevent duplicate evaluation jobs.

The database contains unique constraints for evaluation identity and idempotency.

The production state machine is:

```text
PENDING
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
COMPLETED           FAILED
                       |
                    Retry
                       |
                       v
                     Queue
                       |
                 max retries
                       |
                       v
                      DLQ
```

Workers should update state transactionally and safely handle repeated delivery.

---

## 21. Security Architecture

The production design includes controls for:

### Authentication and authorization

* JWT/OAuth-based authentication
* Role-based access control
* Student/instructor/admin authorization
* Server-derived user identity
* Submission ownership checks

### Artifact security

* File size limits
* MIME/type validation
* Malware scanning
* ZIP bomb protection
* Path traversal protection
* Safe extraction directories
* Object storage isolation

### URL / repository security

* GitHub token isolation
* SSRF protection for external URLs
* Allowlisted integrations
* Restricted network access
* Timeouts and resource limits

### AI security

Project source code and uploaded documents are treated as **untrusted evidence**, not instructions.

This helps reduce prompt-injection risks where a submitted project attempts to manipulate the evaluator.

### Data isolation

Students should only access their own submissions and results.

Instructor/admin access is controlled through RBAC and course/assignment authorization.

---

## 22. Scalability

The target architecture is designed to evolve from approximately:

```text
30 submissions/day
```

to:

```text
10,000 submissions/day
```

10,000 submissions/day is approximately:

```text
417 submissions/hour
6.9 submissions/minute
0.116 submissions/second average
```

Average throughput is not sufficient for capacity planning because evaluation workloads are bursty.

Worker scaling is therefore based on metrics such as:

* Queue depth
* Oldest message age
* Evaluation latency
* CPU utilization
* Memory utilization
* LLM throughput
* Failure rate

The API and workers scale independently.

### Evolution path

```text
                 PoC                  Production
                 ---                  ----------

Queue       Redis Queue       →      SQS + DLQ
Compute     Local Docker      →      ECS/Fargate
Database    PostgreSQL        →      PostgreSQL + optimization
Storage     Local/metadata    →      S3
Vector      pgvector          →      Optimized pgvector
LLM         Mock/provider     →      Production LLM
Auth        PoC identifiers   →      JWT/OAuth + RBAC
Monitoring  Logs              →      CloudWatch + OTel
```

---

## 23. Deployment Architecture

The production deployment is designed for AWS.

```text
                    Internet
                       |
                       v
                  ALB / NGINX
                       |
             +---------+---------+
             |                   |
             v                   v
       ECS/Fargate API     ECS/Fargate Workers
             |                   |
             |                   +---- SQS
             |                   |
             +---------+---------+
                       |
          +------------+-------------+
          |            |             |
          v            v             v
      PostgreSQL      S3          Redis
          |
          v
       pgvector

External:
    GitHub API
    OpenAI / AWS Bedrock

Observability:
    CloudWatch
    OpenTelemetry
```

### CI/CD

The production pipeline is intended to use GitHub Actions for:

```text
Git Push
   |
   v
Install Dependencies
   |
   v
Type Check
   |
   v
Tests
   |
   v
Docker Build
   |
   v
Security Checks
   |
   v
Deploy
   |
   v
Health Check
   |
   v
Release
```

Failed health checks should prevent traffic from being shifted to an unhealthy deployment.

---

## 24. Health Checks

Production services should expose health/readiness checks.

Example:

```text
GET /health
```

and:

```text
GET /ready
```

The readiness check should verify required dependencies before accepting traffic.

For workers, operational health should additionally consider:

* Queue connectivity
* Database connectivity
* Worker heartbeat
* Processing latency
* Repeated failures

---

## 25. Observability

The production architecture uses:

* Structured application logs
* CloudWatch
* OpenTelemetry
* Distributed tracing
* Queue metrics
* Worker metrics
* Evaluation latency
* LLM latency
* LLM error rates
* Token usage
* Cost metrics
* Human-review rates

Important operational metrics include:

```text
submission_processing_latency
evaluation_processing_latency
queue_depth
oldest_queue_message_age
worker_failure_rate
llm_failure_rate
llm_timeout_rate
human_review_rate
evaluation_success_rate
token_usage
estimated_llm_cost
```

---

## 26. Notification

After an evaluation reaches a terminal state, the production architecture emits an evaluation-completed event.

A notification service can consume this event and provide:

* In-app notification
* Email notification
* Instructor notification when human review is required

Notifications are asynchronous and do not block evaluation completion.

If notification delivery fails, the evaluation result remains persisted because PostgreSQL is the source of truth. Notification delivery can be retried independently.

---

## 27. Current Implementation Status

### Completed PoC

* [x] Node.js + TypeScript API
* [x] Express REST API
* [x] Prisma ORM
* [x] PostgreSQL
* [x] pgvector
* [x] Redis
* [x] Redis-based PoC queue
* [x] GitHub ingestion
* [x] Submission extractor abstraction
* [x] Repository file filtering
* [x] Project manifest generation
* [x] Relevant-file analysis
* [x] Content chunking
* [x] Embedding pipeline
* [x] Evaluation chunks
* [x] Rubric-based criterion evaluation
* [x] Deterministic score aggregation
* [x] Evaluation result persistence
* [x] Human review workflow
* [x] Evaluation retry/failure state model
* [x] Audit logging
* [x] Docker Compose environment
* [x] TypeScript validation

### Production roadmap

* [ ] Amazon SQS + DLQ
* [ ] Amazon S3 uploads
* [ ] Production authentication
* [ ] Full RBAC enforcement
* [ ] Additional submission extractors
* [ ] Production LLM provider
* [ ] Structured output validation/recovery
* [ ] Malware scanning
* [ ] ZIP bomb protection
* [ ] Path traversal protection
* [ ] SSRF protection
* [ ] Transactional outbox
* [ ] Automated integration tests
* [ ] ECS/Fargate deployment
* [ ] Worker autoscaling
* [ ] CloudWatch/OpenTelemetry
* [ ] Production notification service
* [ ] Backup and disaster recovery
* [ ] Cost/token monitoring

---

## 28. Validation

The repository has been validated with TypeScript compilation checks:

```bash
npx tsc --noEmit
```

Result:

```text
No TypeScript errors
```

Docker services were also validated:

```bash
docker compose ps
```

Expected local services:

```text
alma-postgres
alma-redis
```

The GitHub ingestion PoC was executed successfully and produced:

```text
[Ingestion] Extracted 1 files
[Ingestion] Project: README
[Ingestion] Relevant files: 1
[Ingestion] Stored 1 embedded chunks

=== Stored Evaluation Chunks ===
README | chunk 0 | 4 tokens

Total chunks: 1
```

This validates the implemented ingestion → analysis → chunking → embedding persistence path.

---

## 29. API Examples

### Create Submission

```http
POST /submissions
Content-Type: application/json
```

Example request:

```json
{
  "assignmentId": "assignment-uuid",
  "studentId": "student-uuid",
  "sourceType": "GITHUB",
  "sourceUrl": "https://github.com/example/project"
}
```

The API creates the submission and artifact, moves the submission into the queued state, and publishes an ingestion job.

---

### Evaluation Job

Conceptually:

```http
POST /evaluations
```

An idempotency key can be used to safely retry client requests:

```http
Idempotency-Key: unique-client-operation-key
```

The evaluation job is processed asynchronously by workers.

---

### Evaluation Status

```http
GET /evaluations/:id/status
```

Example response:

```json
{
  "status": "PROCESSING"
}
```

Possible terminal states include:

```text
COMPLETED
FAILED
HUMAN_REVIEW
CANCELLED
```

---

## 30. Database Design

The database uses PostgreSQL because the system requires:

* Strong transactional consistency
* Relational integrity
* Complex relationships
* Rubric versioning
* Evaluation history
* Human-review state
* Auditability
* JSON support
* Vector search through pgvector

The schema uses indexes for common access patterns and unique constraints for idempotency and versioning.

Examples include:

```text
Assignment → Rubric
Rubric → RubricCriterion
Submission → SubmissionArtifact
Submission → EvaluationJob
EvaluationJob → EvaluationResult
EvaluationResult → EvaluationCriterionResult
EvaluationJob → HumanReview
User → CourseMembership
User → Submission
```

---

## 31. Architectural Trade-offs

The architecture intentionally avoids prematurely adopting every infrastructure component.

### PostgreSQL

Chosen as the transactional source of truth because the domain contains strongly related entities and requires consistent state transitions.

### SQS

Chosen for production asynchronous processing because managed queues provide durability, visibility timeouts, retry behavior, and DLQ support without requiring queue-cluster management.

### Redis

Used for caching, rate limiting, short-lived coordination, and the local PoC queue.

### pgvector

Used initially because vector search can remain close to the transactional project data while the platform is still moderate in scale.

### ECS/Fargate

Provides containerized horizontal scaling without requiring the operational overhead of managing Kubernetes.

### LLM abstraction

The evaluation layer is separated from a specific model provider so that OpenAI, AWS Bedrock, or another provider can be substituted without rewriting the evaluation workflow.

---

## 32. Important Design Principle

The system deliberately separates responsibilities:

```text
PostgreSQL
    ↓
Owns business state

Queue
    ↓
Owns asynchronous delivery

Workers
    ↓
Own processing

LLM
    ↓
Owns evaluation intelligence

Deterministic Scoring
    ↓
Owns final score calculation

Human Review
    ↓
Owns ambiguous / low-confidence decisions
```

This prevents the LLM from becoming the source of truth for workflow state and makes the system easier to retry, audit, scale, and operate.

---

## 33. Future Improvements

Potential future improvements include:

1. Full authentication and authorization
2. S3-based artifact uploads
3. SQS + DLQ production queue
4. Additional artifact extractors
5. Production LLM integration
6. Better embedding models
7. Hybrid keyword + vector retrieval
8. Evaluation caching
9. Automated evaluation regression tests
10. Prompt/version tracking
11. Model/version tracking
12. Cost-aware model routing
13. Instructor analytics
14. Evaluation calibration
15. Disaster recovery
16. Data retention policies
17. Multi-tenant isolation
18. Advanced observability

---

## 34. AI Assistance Disclosure

AI development tools were used during implementation and documentation.

They were used for activities including:

* Architecture brainstorming
* Code assistance
* Debugging
* Documentation drafting
* Technical trade-off exploration
* Review of implementation approaches

The final architecture, implementation decisions, validation, repository changes, and submission documentation were reviewed and adapted for this assignment.

AI-generated suggestions were treated as development assistance rather than as an authority, and implementation decisions were validated against the actual project requirements and runtime behavior.

---

## 35. Assignment Requirement Mapping

| Assignment Requirement    | Covered In                                                     |
| ------------------------- | -------------------------------------------------------------- |
| System Architecture       | `docs/architecture.md`                                         |
| Processing Pipeline       | `docs/sequence.md`                                             |
| API Design                | `docs/api-design.md`                                           |
| Database Design           | `docs/erd.md`                                                  |
| AI / LLM Architecture     | `docs/ai-evaluation.md`                                        |
| Reliability               | `docs/reliability-and-scaling.md`                              |
| Security                  | `docs/reliability-and-scaling.md` + architecture documentation |
| Scalability               | `docs/reliability-and-scaling.md`                              |
| Deployment                | `docs/architecture.md` + this README                           |
| Technical Decisions       | `docs/technical-decisions.md`                                  |
| Alternatives / Trade-offs | `docs/technical-decisions.md`                                  |
| Implementation Roadmap    | Main assignment document                                       |
| AI Disclosure             | Main assignment document + this README                         |

---

## 36. References

Technical references used during architecture research include:

* PostgreSQL Documentation
  https://www.postgresql.org/docs/

* Prisma Documentation
  https://www.prisma.io/docs/

* Amazon SQS Documentation
  https://docs.aws.amazon.com/sqs/

* Amazon S3 Documentation
  https://docs.aws.amazon.com/s3/

* Amazon ECS Documentation
  https://docs.aws.amazon.com/ecs/

* Amazon ElastiCache Documentation
  https://docs.aws.amazon.com/elasticache/

* pgvector
  https://github.com/pgvector/pgvector

* OpenAI API Documentation
  https://platform.openai.com/docs/

* OpenTelemetry Documentation
  https://opentelemetry.io/docs/

* GitHub REST API Documentation
  https://docs.github.com/en/rest

---

## 37. Conclusion

The AI-Powered Project Evaluation Platform is designed as an asynchronous, scalable evaluation system rather than a synchronous API that performs expensive AI processing inside HTTP requests.

The PoC demonstrates the core technical path:

```text
Submission
    ↓
GitHub Ingestion
    ↓
Project Analysis
    ↓
Relevant Evidence
    ↓
Chunking
    ↓
Embeddings / pgvector
    ↓
Rubric Evaluation
    ↓
Deterministic Scoring
    ↓
Human Review
    ↓
Final Result
```

The production architecture extends this foundation with:

```text
S3
+
SQS / DLQ
+
ECS / Fargate
+
Production LLM Providers
+
Authentication / RBAC
+
Security Controls
+
Observability
+
Autoscaling
```

The design focuses on clear ownership boundaries, asynchronous processing, idempotency, evidence-based AI evaluation, deterministic scoring, human oversight, and an incremental path from a local PoC to a production AWS deployment.
