# Technical Decisions

## 1. Purpose

This document records the major technical decisions for the AI-Powered Project Evaluation Platform and explains the reasoning behind them.

The goal is not to select technologies simply because they are popular, but to choose components that support:

* asynchronous evaluation
* reliability
* scalability
* AI/LLM workloads
* large project artifacts
* human review
* operational simplicity
* future growth to approximately 10,000 submissions/day

The architecture distinguishes between the current PoC implementation and the intended production architecture.

---

## 2. Node.js + TypeScript for API and Workers

### Decision

Use Node.js with TypeScript for:

* REST API
* orchestration
* background workers
* shared domain types

### Why

The platform is heavily I/O-oriented.

Typical operations include:

* GitHub API calls
* S3 operations
* PostgreSQL queries
* Redis/SQS operations
* LLM API calls
* embedding requests

Node.js handles these workloads efficiently without requiring a thread per request.

TypeScript provides:

* compile-time type safety
* shared contracts
* safer refactoring
* strong ecosystem support
* good integration with REST APIs and AI SDKs

### Alternative considered

Python could also support the AI pipeline effectively, particularly for data processing and ML-heavy workloads.

However, the evaluation platform primarily orchestrates external services rather than training models.

Node.js + TypeScript therefore keeps the API and worker stack consistent.

---

## 3. PostgreSQL as the Source of Truth

### Decision

Use PostgreSQL as the primary transactional database.

### Why

The platform has strongly relational data:

```text
User
  |
  +-- Submission
        |
        +-- Artifact
        |
        +-- EvaluationJob
              |
              +-- EvaluationAttempt
              +-- EvaluationResult
              +-- HumanReview
```

PostgreSQL provides:

* ACID transactions
* foreign keys
* unique constraints
* indexes
* JSON/JSONB support
* mature operational tooling
* strong consistency

The workflow requires transactional state changes such as:

```text
EvaluationJob -> COMPLETED
Submission -> COMPLETED
HumanReview -> APPROVED
```

These changes benefit from relational transactions.

### Alternative considered

MongoDB or another document database could store evaluation documents conveniently.

However, workflow state, uniqueness, reviewer ownership, rubric relationships, and audit data are naturally relational.

PostgreSQL was therefore selected as the transactional source of truth.

---

## 4. pgvector for Retrieval

### Decision

Use PostgreSQL with pgvector for the initial vector retrieval layer.

### Why

The platform already depends on PostgreSQL.

Using pgvector allows:

* embeddings and relational metadata in one database
* similarity search
* transactional consistency
* simpler deployment
* fewer infrastructure components

Evaluation chunks can store:

```text
submissionId
filePath
chunkIndex
content
tokenEstimate
embedding
```

The embedding index can use HNSW for efficient approximate nearest-neighbor search.

### Alternative considered

A dedicated vector database could provide greater specialization at very large scale.

However, the initial workload does not justify introducing another distributed datastore.

If vector search becomes a bottleneck, it can later be separated behind a retrieval abstraction.

---

## 5. Amazon S3 for Submission Artifacts

### Decision

Use S3 for large submission artifacts.

### Why

Submissions can be:

* ZIP files
* PDFs
* documents
* videos
* repository snapshots
* large project bundles

Some submissions may exceed 1 GB.

Keeping these files in PostgreSQL would unnecessarily increase database storage and backup costs.

S3 provides:

* durable object storage
* large object support
* lifecycle policies
* encryption
* versioning
* presigned URLs
* scalable throughput

The database stores metadata and object references rather than large binary files.

### Alternative considered

Local filesystem storage is suitable only for development.

It is not appropriate for horizontally scaled production workers because local files are not guaranteed to exist on another worker.

---

## 6. Amazon SQS for Production Queue

### Decision

Use SQS for production asynchronous job processing.

### Why

Evaluation jobs can take several minutes and should not block API requests.

SQS provides:

* durable message delivery
* visibility timeout
* retry behavior
* horizontal worker consumption
* Dead Letter Queues
* integration with AWS infrastructure

The API can therefore respond quickly:

```text
POST /evaluations
        |
        v
     PostgreSQL
        |
        v
       SQS
        |
        v
     202 Accepted
```

Workers consume the evaluation asynchronously.

### Alternative considered: Redis

Redis is currently used in the PoC because it is simple to run locally.

However, the current Redis list implementation uses:

```text
LPUSH
BRPOP
```

A worker can remove a job before processing it completely.

If the worker crashes after `BRPOP`, the message can be lost.

SQS visibility timeout provides a safer production model:

```text
receive message
      |
message becomes invisible
      |
worker succeeds
      |
delete message
```

If the worker crashes, the message becomes visible again.

Therefore:

```text
PoC     -> Redis
Production -> SQS + DLQ
```

---

## 7. Redis for Cache and Coordination

### Decision

Use Redis/Valkey for:

* rate limiting
* short-lived cache
* temporary coordination
* optional distributed locks
* development queue implementation

### Why

Redis is optimized for low-latency in-memory operations.

It is useful for data that does not represent the authoritative workflow state.

Examples:

```text
rate-limit:user:123
cache:rubric:456
lock:evaluation:789
```

### Important constraint

Redis should not become the source of truth for evaluation state.

PostgreSQL remains authoritative.

### Production option

AWS ElastiCache/Valkey or another managed Redis-compatible service can be used when production scale requires it.

---

## 8. REST API

### Decision

Use REST for the public application API.

### Why

The platform has straightforward resource-oriented operations:

```text
/submissions
/evaluations
/rubrics
/reviews
```

REST provides:

* simple client integration
* predictable HTTP semantics
* easy debugging
* compatibility with web/mobile clients
* straightforward authentication and authorization

Long-running operations are represented as resources instead of synchronous requests.

Example:

```text
POST /evaluations
        |
        v
202 Accepted

GET /evaluations/{id}
        |
        v
Current evaluation state
```

### Alternative considered

GraphQL could provide flexible dashboard queries.

However, it would add complexity without being necessary for the core asynchronous evaluation workflow.

GraphQL could be introduced later if dashboard query requirements justify it.

---

## 9. Prisma ORM

### Decision

Use Prisma for database access from the TypeScript application.

### Why

Prisma provides:

* typed database queries
* schema-driven development
* migrations
* relation handling
* strong TypeScript integration

The evaluation platform contains many related entities, so typed relational access reduces accidental query errors.

### Important principle

Prisma does not replace database constraints.

Critical guarantees remain enforced in PostgreSQL through:

* unique constraints
* foreign keys
* indexes
* transactions

---

## 10. Module Separation

### Decision

Separate the application into:

```text
apps/
  api/
  worker/

packages/
  shared/
```

### Why

API and worker workloads have different responsibilities.

The API handles:

* authentication
* validation
* resource creation
* status queries

Workers handle:

* ingestion
* parsing
* embeddings
* LLM calls
* evaluation
* retries

This allows them to scale independently.

For example:

```text
API instances: 2
Worker instances: 10
```

The number of workers can increase without increasing API capacity.

---

## 11. Asynchronous Evaluation

### Decision

Evaluation is asynchronous.

### Why

An evaluation may require:

* repository extraction
* file classification
* chunking
* embedding
* retrieval
* multiple LLM calls
* result aggregation

The complete process may take approximately 2–15 minutes.

Holding an HTTP request open for this duration would create unnecessary resource consumption and poor user experience.

Instead:

```text
Client
  |
  v
POST /evaluations
  |
  v
202 Accepted
  |
  v
Queue
  |
  v
Worker
```

The client polls or subscribes to evaluation status.

---

## 12. Eventual Processing vs Immediate Completion

### Decision

The platform guarantees durable acceptance of evaluation work rather than immediate evaluation completion.

### Why

A submission can be accepted even when:

* workers are busy
* LLM providers are temporarily slow
* many submissions arrive simultaneously

The queue absorbs bursts.

This provides backpressure and allows worker capacity to scale independently.

---

## 13. Idempotency Keys

### Decision

Support `Idempotency-Key` for evaluation creation.

### Why

Network failures can leave clients uncertain about whether an operation succeeded.

For example:

```text
Client
  |
  | POST evaluation
  v
API
  |
  | job created
  v
Network timeout
```

The client may retry.

Without idempotency, two evaluation jobs could be created.

With the same idempotency key:

```text
Retry
  |
  v
Existing EvaluationJob
```

The operation becomes safely repeatable.

---

## 14. Unique Evaluation Key

### Decision

Use a deterministic evaluation key for the submission/rubric combination.

Example:

```text
rubric:<rubric-id>
```

### Why

Idempotency keys protect against duplicate client requests.

The evaluation key protects against duplicate logical evaluations.

These solve different problems.

```text
Idempotency-Key
    |
    +-- protects request retries

Evaluation-Key
    |
    +-- protects logical duplicate evaluations
```

---

## 15. State Machine Instead of Boolean Flags

### Decision

Represent workflow state using explicit enums.

Examples:

```text
PENDING
QUEUED
PROCESSING
EVALUATING
HUMAN_REVIEW
COMPLETED
FAILED
```

### Why

Multiple independent boolean flags such as:

```text
isProcessing
isCompleted
isFailed
needsReview
```

can create contradictory combinations.

Explicit states make transitions easier to reason about.

---

## 16. Evaluation Attempts

### Decision

Store every execution attempt separately.

### Why

A single evaluation may fail and then succeed later.

Example:

```text
Attempt 1 -> timeout
Attempt 2 -> provider 503
Attempt 3 -> success
```

Keeping all attempts provides:

* debugging information
* retry visibility
* operational metrics
* auditability

The final evaluation result remains separate from individual attempts.

---

## 17. Human-in-the-Loop Evaluation

### Decision

Route uncertain AI evaluations to human review.

Example conditions:

```text
confidence < threshold
```

or:

```text
missing evidence
```

### Why

LLM-based evaluation is probabilistic.

The platform should not automatically treat low-confidence output as definitive.

Human review provides a controlled fallback.

Reviewer roles are:

```text
INSTRUCTOR
ADMIN
```

---

## 18. Deterministic Score Aggregation

### Decision

Use the LLM for criterion-level reasoning but calculate final scores deterministically.

### Why

The LLM should provide:

* score recommendation
* reasoning
* evidence
* confidence

The application should perform:

```text
criterion scores
        |
        v
weighted aggregation
        |
        v
final score
```

This avoids allowing an LLM to arbitrarily calculate the final weighted result.

For example:

```text
Functionality = 20 / 25
Code Quality = 16 / 20
Architecture = 17 / 20
```

The application computes the final total based on the rubric configuration.

---

## 19. Rubric Configuration

### Decision

Rubrics are data, not hard-coded application logic.

### Why

Different courses may use different criteria.

For example:

```text
Rubric A
  Functionality 25%
  Code Quality 20%
  Architecture 20%

Rubric B
  Correctness 40%
  Testing 30%
  Documentation 30%
```

The evaluation engine should operate against the configured rubric.

This allows the platform to support multiple assignments without changing application code.

---

## 20. AI Provider Abstraction

### Decision

Hide the underlying LLM provider behind an application interface.

Conceptually:

```text
Evaluation Service
        |
        v
     LLMClient
     /       \
 OpenAI    Bedrock
```

### Why

This avoids coupling business logic directly to one provider.

Benefits:

* provider fallback
* model upgrades
* easier testing
* cost optimization
* provider-specific retry handling

---

## 21. RAG Instead of Sending the Entire Repository

### Decision

Use chunking and retrieval rather than passing the entire project to the LLM.

### Why

Large projects may contain:

* thousands of files
* generated assets
* dependencies
* lock files
* binary files
* documentation
* source code

Sending everything to the model is inefficient and can exceed context limits.

Instead:

```text
Repository
    |
    v
File classification
    |
    v
Relevant files
    |
    v
Chunking
    |
    v
Embeddings
    |
    v
Vector search
    |
    v
Rubric-specific context
    |
    v
LLM
```

This reduces token usage and improves relevance.

---

## 22. File Classification Before Embedding

### Decision

Do not embed every file.

### Why

Files such as:

```text
node_modules/
dist/
build/
.git/
binary assets
lock files
generated bundles
```

usually provide little value for rubric evaluation.

The ingestion pipeline first classifies files and selects relevant content.

This reduces:

* storage
* embedding cost
* processing time
* retrieval noise

---

## 23. Security Scanning Before AI Processing

### Decision

Treat submitted files as untrusted.

### Why

Submissions can contain:

* malicious files
* oversized archives
* unexpected formats
* prompt injection content
* potentially executable code

The ingestion pipeline should validate:

* archive size
* file count
* file type
* path traversal
* suspicious content

AI evaluation should only happen after basic security validation.

---

## 24. No Arbitrary Code Execution in the Initial Pipeline

### Decision

The evaluation pipeline primarily performs static analysis.

### Why

Executing arbitrary student projects introduces significant security complexity.

The initial system can evaluate:

* source code
* project structure
* configuration
* documentation
* tests
* dependency manifests

without running the application.

If execution becomes a future requirement, it should happen in a dedicated sandbox.

---

## 25. AWS ECS/Fargate for Production Workers

### Decision

Use ECS/Fargate for production API and worker containers.

### Why

Fargate provides container execution without requiring server management.

It supports:

* horizontal scaling
* isolated tasks
* container-based deployment
* integration with ALB
* CloudWatch integration

Workers can scale independently based on SQS workload.

### Alternative considered

Kubernetes provides more control but introduces additional operational complexity.

For this platform's expected scale, ECS/Fargate provides a simpler operational model.

---

## 26. Docker for Local and Production Consistency

### Decision

Containerize API and worker applications.

### Why

Containers provide consistent:

* Node.js version
* system dependencies
* environment
* build process

The same application image can be used across:

```text
local development
CI
staging
production
```

---

## 27. GitHub Actions for CI/CD

### Decision

Use GitHub Actions for CI/CD.

Pipeline:

```text
Pull Request
    |
    v
Lint
    |
    v
Typecheck
    |
    v
Tests
    |
    v
Build
    |
    v
Docker image
    |
    v
Deployment
```

### Why

The code already resides in GitHub and GitHub Actions integrates naturally with the repository.

---

## 28. OpenTelemetry + CloudWatch

### Decision

Use OpenTelemetry for application tracing and CloudWatch for AWS-native operational monitoring.

### Why

The system contains multiple distributed components:

```text
API
 |
SQS
 |
Worker
 |
GitHub
 |
LLM
 |
PostgreSQL
```

Tracing allows one evaluation job to be followed across these components.

CloudWatch provides:

* logs
* metrics
* alarms
* AWS service visibility

---

## 29. Outbox Pattern for Production

### Decision

Use a transactional outbox when moving from the PoC queue implementation to production.

### Why

Without an outbox:

```text
DB transaction
     |
     +---- succeeds
     |
Queue publish
     |
     +---- fails
```

The database says the work exists, but no queue message exists.

The outbox pattern stores the event in the same database transaction.

```text
DB Transaction
   |
   +-- EvaluationJob
   |
   +-- OutboxEvent
            |
            v
      Outbox Publisher
            |
            v
           SQS
```

This provides stronger consistency between database state and asynchronous work.

---

## 30. Why Not Microservices Initially?

### Decision

Use a modular application with separate API and worker processes rather than many independent microservices.

### Why

The initial platform is still establishing domain boundaries.

Splitting immediately into many services would introduce:

* more deployments
* more networking
* distributed transactions
* more observability complexity
* more operational overhead

The architecture can evolve later.

The important boundary initially is:

```text
API
 |
 +-- shared domain/data
 |
Worker
```

This provides independent scaling without premature service fragmentation.

---

## 31. Why Not Kafka Initially?

### Decision

Do not use Kafka for the initial production design.

### Why

Kafka is powerful for high-throughput event streaming, but the core requirement is reliable task processing with:

* retries
* visibility timeout
* DLQ
* worker consumption

SQS provides these capabilities with less operational overhead.

Kafka could become appropriate later if the platform develops:

* high-volume event streaming
* multiple independent consumers
* replay-heavy event pipelines
* complex event-driven analytics

---

## 32. Why Not a Dedicated Workflow Engine Initially?

### Decision

Do not introduce Temporal or another workflow engine in the first version.

### Why

The initial workflow can be represented through:

* PostgreSQL state
* SQS jobs
* evaluation attempts
* retry policies
* human review state

A workflow engine could become useful when the system requires:

* very long-running workflows
* complex branching
* timers
* compensation
* sophisticated workflow recovery

The current architecture leaves room for this evolution.

---

## 33. Why Not Store Everything in PostgreSQL?

### Decision

Use PostgreSQL for metadata and transactional state, but not large binary artifacts.

### Separation

```text
PostgreSQL
  -> metadata
  -> workflow state
  -> rubric
  -> evaluation results
  -> audit logs

S3
  -> ZIP
  -> PDF
  -> documents
  -> videos
  -> repository artifacts
```

This keeps the database optimized for transactional workloads.

---

## 34. Why Separate Human Review From AI Evaluation?

### Decision

Human review is a separate workflow state.

### Why

AI evaluation and human review have different characteristics.

AI evaluation is:

* asynchronous
* automated
* repeatable
* probabilistic

Human review is:

* manual
* permission-controlled
* auditable
* decision-oriented

Separating them keeps responsibilities clear.

---

## 35. Production Evolution Path

The platform can evolve incrementally.

### Phase 1 — PoC

```text
Next.js / REST API
       |
PostgreSQL
       |
Redis Queue
       |
Worker
       |
LLM
```

### Phase 2 — Production

```text
ALB
 |
ECS API
 |
PostgreSQL
 |
SQS
 |
ECS Workers
 |
S3
 |
LLM Providers
```

### Phase 3 — Higher Scale

Potential additions:

```text
Read replicas
Dedicated vector infrastructure
Advanced workflow orchestration
Multiple AI providers
Event streaming
Dedicated analytics pipeline
```

These should be introduced only when actual workload or operational requirements justify them.

---

## 36. Decision Summary

| Area                   | Decision                   | Primary Reason                         |
| ---------------------- | -------------------------- | -------------------------------------- |
| API                    | Node.js + TypeScript       | I/O-heavy workload and type safety     |
| Database               | PostgreSQL                 | Relational workflow and transactions   |
| Vector search          | pgvector                   | Simple initial RAG architecture        |
| Artifact storage       | S3                         | Large durable objects                  |
| Queue                  | SQS                        | Durable async processing               |
| PoC queue              | Redis                      | Local simplicity                       |
| Cache/rate limiting    | Redis/Valkey               | Low-latency temporary state            |
| API style              | REST                       | Simple resource-oriented interface     |
| ORM                    | Prisma                     | Type-safe database access              |
| Workers                | ECS/Fargate                | Independent horizontal scaling         |
| Containers             | Docker                     | Consistent runtime                     |
| CI/CD                  | GitHub Actions             | Native GitHub integration              |
| Observability          | OpenTelemetry + CloudWatch | Distributed tracing and AWS monitoring |
| AI                     | Provider abstraction       | Flexibility and resilience             |
| Evaluation             | RAG + rubric-aware LLM     | Context efficiency                     |
| Scoring                | Deterministic aggregation  | Predictable weighted results           |
| Human review           | Dedicated workflow         | Handle uncertainty                     |
| Production consistency | Outbox pattern             | DB/queue reliability                   |

---

## 37. Final Principle

The architecture favors the simplest component that satisfies the current requirement while preserving a clear path to production scale.

The key design choices are therefore:

```text
PostgreSQL
    -> durable business state

S3
    -> large artifacts

SQS
    -> asynchronous delivery

Workers
    -> long-running processing

LLM
    -> evaluation intelligence

Deterministic application logic
    -> scoring and workflow decisions

Human review
    -> uncertain cases

Redis/Valkey
    -> cache, rate limiting, coordination

Observability
    -> operational visibility
```

This separation keeps the system understandable for the PoC while allowing individual components to scale independently as submission volume grows.
