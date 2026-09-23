# API Design

## 1. Overview

The API exposes the application workflow for:

* student submissions
* submission artifacts
* evaluation jobs
* evaluation results
* evaluation retries
* human review
* evaluation status

The API is versioned under:

```
/api/v1
```

The API is intentionally asynchronous for long-running operations such as ingestion and AI evaluation.

---

# 2. API Architecture

```
Client
   |
   v
Load Balancer / API Gateway
   |
   v
Node.js API
   |
   +--------------------+
   |                    |
   v                    v
PostgreSQL          Queue
                        |
                        v
                     Workers
                        |
                        v
                   AI Services
```

The API owns request validation, authorization, persistence, idempotency, and queue publishing.

Workers own long-running processing.

---

# 3. API Principles

The API follows these principles:

1. REST-style resource endpoints.
2. `/api/v1` versioning.
3. JSON request and response bodies.
4. UUID identifiers.
5. HTTP status codes represent operation state.
6. Long-running operations return `202 Accepted`.
7. Idempotency keys protect retryable creation operations.
8. Validation occurs before database writes.
9. Database constraints provide concurrency protection.
10. Internal implementation details are not exposed to clients.
11. Errors use a consistent response structure.
12. Authentication and authorization are enforced at the API boundary in production.

---

# 4. Common Headers

Typical request headers:

```
Content-Type: application/json
Authorization: Bearer <access-token>
```

For idempotent operations:

```
Idempotency-Key: <unique-client-key>
```

Example:

```
Idempotency-Key: evaluation-2026-001
```

The key should be bounded in length and stored with the corresponding operation.

---

# 5. Common Response Format

Successful responses return JSON.

Example:

```
{
  "data": {
    "id": "uuid",
    "status": "QUEUED"
  }
}
```

For asynchronous creation endpoints, the current PoC may return the resource directly:

```
{
  "id": "uuid",
  "status": "QUEUED"
}
```

A production API can standardize all successful responses around a common envelope.

---

# 6. Common Error Format

Errors should use a consistent structure.

Example:

```
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Submission is not ready for evaluation.",
    "details": {}
  }
}
```

Suggested error codes:

```
INVALID_REQUEST
VALIDATION_ERROR
NOT_FOUND
CONFLICT
UNAUTHORIZED
FORBIDDEN
RATE_LIMITED
PROCESSING_ERROR
INTERNAL_ERROR
```

The API should avoid returning stack traces or internal infrastructure details.

---

# 7. HTTP Status Codes

Common status codes:

```
200 OK
201 Created
202 Accepted
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
503 Service Unavailable
```

---

# 8. Health Endpoint

## GET /health

Used by load balancers and container orchestration health checks.

Example response:

```
{
  "status": "ok",
  "service": "alma-evaluation-api"
}
```

The health endpoint should remain lightweight.

A separate readiness endpoint can verify dependencies in production.

---

# 9. Readiness Endpoint

## GET /ready

Production readiness can verify:

* database connectivity
* queue connectivity
* required configuration
* external service availability where appropriate

Example:

```
{
  "status": "ready"
}
```

If a critical dependency is unavailable:

```
HTTP 503
```

The liveness check should not depend on every external service.

---

# 10. Create Submission

## POST /api/v1/submissions

Creates a student submission.

Example request:

```
{
  "assignmentId": "assignment-uuid",
  "studentId": "student-uuid",
  "artifact": {
    "type": "GITHUB",
    "sourceUrl": "https://github.com/example/project"
  }
}
```

Alternative artifact types may include:

```
ZIP
PDF
GOOGLE_DRIVE
VIDEO
DOCUMENT
LIVE_URL
```

The exact artifact metadata depends on the submission source.

---

# 11. Create Submission Response

A successful submission creation returns:

```
HTTP 201 Created
```

Example:

```
{
  "id": "submission-uuid",
  "status": "UPLOADED",
  "createdAt": "2026-09-23T10:00:00Z"
}
```

If ingestion must happen asynchronously, the API publishes an ingestion job and can return:

```
status = QUEUED
```

depending on the workflow stage.

---

# 12. Submission Validation

Before creating a submission, the API should validate:

* assignment exists
* student exists
* student is authorized for the assignment
* artifact type is supported
* source URL is valid for URL-based submissions
* uploaded object exists where applicable
* submission size is within configured limits
* duplicate submission policy

Invalid input returns:

```
HTTP 400
```

Authorization failures return:

```
HTTP 403
```

---

# 13. Get Submission

## GET /api/v1/submissions/:id

Returns submission information.

Example:

```
{
  "id": "submission-uuid",
  "assignmentId": "assignment-uuid",
  "studentId": "student-uuid",
  "status": "READY",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Student users should only access their own submissions unless they have an instructor/admin role.

---

# 14. Get Submission Evaluations

## GET /api/v1/submissions/:submissionId/evaluations

Returns evaluation jobs associated with a submission.

Example:

```
{
  "data": [
    {
      "id": "evaluation-job-uuid",
      "status": "COMPLETED",
      "rubricId": "rubric-uuid",
      "createdAt": "...",
      "completedAt": "..."
    }
  ]
}
```

This endpoint is useful for the student and instructor dashboards.

---

# 15. Create Evaluation

## POST /api/v1/evaluations

Creates an evaluation job for a submission.

Example request:

```
{
  "submissionId": "submission-uuid",
  "rubricId": "rubric-uuid"
}
```

Required header:

```
Idempotency-Key: evaluation-2026-001
```

The API validates:

* submission exists
* rubric exists
* rubric belongs to the relevant assignment
* submission is ready
* project manifest exists
* artifact exists
* requester is authorized

---

# 16. Create Evaluation Response

Evaluation is asynchronous.

The API returns:

```
HTTP 202 Accepted
```

Example:

```
{
  "id": "evaluation-job-uuid",
  "status": "QUEUED"
}
```

The worker performs the actual evaluation.

The client can poll the evaluation resource.

---

# 17. Evaluation Creation Sequence

```
Client
  |
  | POST /evaluations
  v
API
  |
  +---- Validate request
  |
  +---- Check idempotency
  |
  +---- Load submission
  |
  +---- Load rubric
  |
  +---- Create EvaluationJob
  |
  +---- Publish queue job
  |
  v
202 Accepted
  |
  v
Worker processes asynchronously
```

---

# 18. Idempotency

Evaluation creation supports idempotency.

Example:

```
Idempotency-Key:
evaluation-2026-001
```

First request:

```
Request
  |
  v
EvaluationJob created
  |
  v
202 Accepted
```

Duplicate request:

```
Same Idempotency-Key
  |
  v
Existing EvaluationJob
  |
  v
Existing resource returned
```

This protects against:

* network retries
* client retries
* duplicate button clicks
* gateway retries
* request timeout followed by client retry

---

# 19. Database-Level Idempotency

Application-level checks are not sufficient for concurrent requests.

The database enforces uniqueness.

The current model contains:

```
@@unique([submissionId, evaluationKey])
```

and:

```
@@unique([submissionId, idempotencyKey])
```

This protects against race conditions where two API requests attempt to create the same evaluation simultaneously.

---

# 20. Get Evaluation

## GET /api/v1/evaluations/:id

Returns the evaluation job and, when available, its result.

Example:

```
{
  "id": "evaluation-job-uuid",
  "status": "COMPLETED",
  "rubricId": "rubric-uuid",
  "submissionId": "submission-uuid",
  "result": {
    "totalScore": 80,
    "maxScore": 100,
    "summary": "Evaluation completed."
  }
}
```

The endpoint can include criterion-level results for authorized users.

---

# 21. Evaluation States

Possible evaluation states include:

```
PENDING
QUEUED
FAILED
HUMAN_REVIEW
COMPLETED
```

The worker internally tracks execution attempts separately.

An evaluation may therefore have:

```
EvaluationJob
    |
    +---- EvaluationAttempt 1
    |
    +---- EvaluationAttempt 2
    |
    +---- EvaluationResult
```

This separates durable evaluation state from individual execution attempts.

---

# 22. Get Evaluation by Submission

## GET /api/v1/evaluations/submission/:submissionId

Returns evaluations associated with a submission.

Example:

```
{
  "data": [
    {
      "id": "evaluation-job-uuid",
      "status": "COMPLETED",
      "rubricId": "rubric-uuid"
    }
  ]
}
```

This endpoint should be declared before the generic:

```
GET /api/v1/evaluations/:id
```

route in Express so that `/submission/:submissionId` is not incorrectly interpreted as an evaluation ID.

---

# 23. Retry Evaluation

## POST /api/v1/evaluations/:id/retry

Requests a retry for a failed evaluation.

The API should verify:

* evaluation exists
* current status is `FAILED`
* retry limit has not been exceeded
* submission still exists
* required artifact exists
* project manifest is available
* requester has permission to retry

Example response:

```
HTTP 202 Accepted

{
  "id": "evaluation-job-uuid",
  "status": "QUEUED"
}
```

The retry creates another `EvaluationAttempt`.

---

# 24. Retry Limits

A retry policy prevents infinite processing.

Example:

```
Maximum attempts = 3
```

Lifecycle:

```
Attempt 1
   |
   v
FAILED
   |
   v
Retry
   |
   v
Attempt 2
   |
   v
FAILED
   |
   v
Retry
   |
   v
Attempt 3
   |
   +---- success
   |
   +---- failure -> DLQ / manual intervention
```

The exact retry policy should be configurable.

---

# 25. Human Review APIs

Human review endpoints are grouped under:

```
/api/v1/reviews
```

Current operations include:

```
GET  /api/v1/reviews/:id
POST /api/v1/reviews/:id/claim
POST /api/v1/reviews/:id/decision
```

These endpoints allow instructors/admins to inspect, claim, approve, and reject evaluations requiring human review.

---

# 26. Get Human Review

## GET /api/v1/reviews/:id

Returns review information.

Example:

```
{
  "id": "review-uuid",
  "evaluationJobId": "evaluation-job-uuid",
  "status": "REQUESTED",
  "reviewerId": null,
  "comments": null,
  "finalScore": null
}
```

The response may include:

* evaluation result
* criterion results
* rubric information
* evidence
* reviewer information

Access should be restricted to authorized reviewers.

---

# 27. Claim Human Review

## POST /api/v1/reviews/:id/claim

Claims an unassigned review.

Example request:

```
{
  "reviewerId": "reviewer-uuid"
}
```

Current PoC behavior accepts the reviewer ID from the request.

In production, the reviewer identity should come from the authenticated session/JWT rather than trusting a client-supplied identifier.

Successful response:

```
{
  "id": "review-uuid",
  "status": "IN_PROGRESS",
  "reviewerId": "reviewer-uuid"
}
```

---

# 28. Review Claim Concurrency

Two reviewers may attempt to claim the same review simultaneously.

The service therefore performs a conditional database update.

Conceptually:

```
UPDATE HumanReview
SET status = 'IN_PROGRESS',
    reviewerId = '<reviewer>'
WHERE id = '<review-id>'
  AND status = 'REQUESTED'
  AND reviewerId IS NULL
```

Only one request can successfully transition the review.

A second concurrent request receives:

```
HTTP 409 Conflict
```

---

# 29. Review Decision

## POST /api/v1/reviews/:id/decision

Submits an instructor/admin decision.

Example:

```
{
  "reviewerId": "reviewer-uuid",
  "decision": "APPROVED",
  "comments": "Approved after review.",
  "finalScore": 80
}
```

Supported decisions:

```
APPROVED
REJECTED
```

---

# 30. Review Approval

When approved:

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

The API records the review decision and audit event.

If the reviewer supplies a final score, production behavior should ensure that the persisted final evaluation result reflects that score.

---

# 31. Review Rejection

When rejected:

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
Queue
    |
    v
Worker
    |
    v
New EvaluationAttempt
```

The existing evaluation job is reused.

The evaluation is therefore retried without creating a duplicate submission.

---

# 32. Human Review Authorization

Only appropriate roles should perform review actions.

Allowed roles:

```
INSTRUCTOR
ADMIN
```

Student users should not be allowed to:

* claim reviews
* approve evaluations
* reject evaluations
* change final evaluation scores

Authorization should be enforced server-side.

---

# 33. Evaluation Result

The evaluation result contains:

```
totalScore
maxScore
summary
```

and criterion results:

```
criterion
score
maxScore
confidence
reasoning
evidence
```

Example:

```
{
  "totalScore": 80,
  "maxScore": 100,
  "criteria": [
    {
      "criterion": "Code Quality",
      "score": 16,
      "maxScore": 20,
      "confidence": 0.91,
      "evidence": [
        "src/components/",
        "src/services/"
      ]
    }
  ]
}
```

---

# 34. Pagination

List endpoints should support pagination for production-scale datasets.

Example:

```
GET /api/v1/submissions?page=1&limit=20
```

or cursor-based pagination:

```
GET /api/v1/submissions?cursor=<cursor>&limit=20
```

Cursor-based pagination is preferable for large or frequently changing datasets.

---

# 35. Filtering

Instructor/admin endpoints may support filters.

Examples:

```
status
assignmentId
studentId
rubricId
createdAt
reviewStatus
```

Example:

```
GET /api/v1/evaluations?status=HUMAN_REVIEW
```

Filtering should be validated against an allowlist of supported fields.

---

# 36. Sorting

List APIs can support controlled sorting.

Example:

```
GET /api/v1/evaluations?sort=createdAt&order=desc
```

The API should not directly interpolate arbitrary client input into SQL.

Only supported sort fields should be accepted.

---

# 37. Authentication

Production authentication can use:

```
JWT
OAuth/OIDC
session-based authentication
```

The API extracts the authenticated user identity from the trusted authentication layer.

For example:

```
Authorization: Bearer <token>
```

The server derives:

```
userId
role
```

from the validated token.

Client-provided user IDs should not be trusted for authorization decisions.

---

# 38. Authorization

Authorization should be resource-aware.

Examples:

Student:

```
Can read own submissions
Can read own evaluation results
```

Instructor:

```
Can review assigned/course evaluations
Can access student evaluation results
```

Admin:

```
Can manage system-wide resources
```

Authorization checks should occur before sensitive database operations.

---

# 39. Input Validation

All request bodies should be validated.

Validation includes:

* UUID format
* enum values
* string length
* URL format
* numeric ranges
* required fields
* maximum payload size
* idempotency key length

Example:

```
finalScore >= 0
```

and:

```
finalScore <= maxScore
```

The API should reject invalid input before executing expensive operations.

---

# 40. Request Size Limits

The API should not accept large binary files directly through ordinary JSON requests.

For large submissions:

```
Client
   |
   v
API
   |
   v
Presigned S3 URL
   |
   v
Object Storage
```

The client uploads directly to object storage.

The API receives only metadata.

This avoids unnecessarily consuming API server memory and bandwidth.

---

# 41. Artifact Upload Flow

Production upload flow:

```
Client
  |
  | Request upload
  v
API
  |
  | Generate presigned URL
  v
S3
  |
  | Upload directly
  v
Object Storage
  |
  | Confirm metadata
  v
API
  |
  v
Submission Artifact
  |
  v
Ingestion Queue
```

This is more suitable for files approaching 1 GB.

---

# 42. GitHub Submission Flow

For GitHub repositories:

```
Client
  |
  | Repository URL
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
Repository Metadata + Files
  |
  v
Evaluation Pipeline
```

The worker should enforce repository and file-size limits.

---

# 43. Rate Limiting

Production API rate limits should protect:

* submission creation
* evaluation creation
* retry endpoints
* review decisions

Example policy:

```
POST /evaluations
    limited per user

POST /reviews/:id/decision
    limited per reviewer
```

Redis can be used for distributed rate limiting.

---

# 44. Error Handling

The API should distinguish client and server failures.

Example:

Invalid UUID:

```
HTTP 400
```

Resource missing:

```
HTTP 404
```

Concurrent evaluation:

```
HTTP 409
```

Unauthorized:

```
HTTP 401
```

Forbidden:

```
HTTP 403
```

Rate limit exceeded:

```
HTTP 429
```

Unexpected server error:

```
HTTP 500
```

Dependency unavailable:

```
HTTP 503
```

---

# 45. Asynchronous Processing

Long-running operations should never depend on an open HTTP request.

Example:

```
POST /evaluations
      |
      v
   202
      |
      v
Queue
      |
      v
  Worker
      |
      v
Evaluation
```

The client retrieves state through:

```
GET /evaluations/:id
```

This avoids:

* HTTP timeouts
* overloaded API servers
* long-held connections
* poor user experience

---

# 46. API and Database Responsibility

The API performs:

```
validation
authorization
transaction coordination
idempotency
persistence
queue publishing
```

The database performs:

```
durable state
relationships
uniqueness constraints
referential integrity
transactional consistency
```

The queue performs:

```
asynchronous work delivery
```

The worker performs:

```
expensive processing
```

The LLM performs:

```
evaluation intelligence
```

---

# 47. API and Queue Consistency

The API may need to update PostgreSQL and publish a queue message.

These operations can fail independently.

For production:

```
API Transaction
    |
    +---- business state
    |
    +---- outbox event
              |
              v
         Publisher
              |
              v
             SQS
```

This avoids relying on an unreliable dual-write sequence.

The current PoC can publish directly to the queue for simplicity.

---

# 48. API Observability

Every important request should have a correlation/request ID.

Example:

```
X-Request-Id: 8d4f...
```

The ID can be propagated to:

```
API
  |
  v
Database metadata / logs
  |
  v
Queue
  |
  v
Worker
  |
  v
LLM calls
```

Important API metrics include:

* request count
* error rate
* latency
* 4xx rate
* 5xx rate
* evaluation creation rate
* retry rate
* human-review rate

---

# 49. Security

The production API should include:

* HTTPS
* authentication
* role-based authorization
* request validation
* rate limiting
* security headers
* restricted CORS
* payload limits
* secret management
* audit logging
* safe error responses

The current Node.js API uses Helmet for security headers.

CORS should be restricted to approved frontend origins in production.

---

# 50. API Versioning

The API uses:

```
/api/v1
```

Breaking changes should result in a new version.

Example:

```
/api/v1/evaluations
/api/v2/evaluations
```

Non-breaking changes can generally be introduced within the existing version.

---

# 51. Endpoint Summary

| Method | Endpoint                                        | Purpose                       |
| ------ | ----------------------------------------------- | ----------------------------- |
| GET    | `/health`                                       | Liveness check                |
| GET    | `/ready`                                        | Dependency readiness          |
| POST   | `/api/v1/submissions`                           | Create submission             |
| GET    | `/api/v1/submissions/:id`                       | Get submission                |
| GET    | `/api/v1/submissions/:submissionId/evaluations` | List submission evaluations   |
| POST   | `/api/v1/evaluations`                           | Create evaluation             |
| GET    | `/api/v1/evaluations/:id`                       | Get evaluation                |
| GET    | `/api/v1/evaluations/submission/:submissionId`  | Get evaluations by submission |
| POST   | `/api/v1/evaluations/:id/retry`                 | Retry failed evaluation       |
| GET    | `/api/v1/reviews/:id`                           | Get human review              |
| POST   | `/api/v1/reviews/:id/claim`                     | Claim human review            |
| POST   | `/api/v1/reviews/:id/decision`                  | Approve/reject review         |

---

# 52. Current PoC vs Production API

## Current PoC

The implemented API demonstrates:

* Express API
* health endpoint
* submission endpoints
* evaluation creation
* evaluation retrieval
* evaluation retry
* human-review retrieval
* review claiming
* review decisions
* idempotency
* PostgreSQL persistence
* Redis queue integration

## Production Enhancements

Production would additionally require:

* authentication
* JWT/OIDC integration
* resource-level authorization
* presigned S3 uploads
* SQS
* DLQ
* outbox processing
* distributed rate limiting
* stricter CORS
* API gateway/load balancer
* centralized observability
* request tracing
* stronger upload validation

---

# 53. Example End-to-End API Flow

```
1. Student creates submission

   POST /api/v1/submissions

   -> 201 Created

2. System processes submission

   -> Queue
   -> Worker
   -> READY

3. Evaluation is requested

   POST /api/v1/evaluations
   Idempotency-Key: evaluation-001

   -> 202 Accepted

4. Client checks status

   GET /api/v1/evaluations/:id

   -> QUEUED

5. Worker processes evaluation

   -> EVALUATING
   -> COMPLETED

   or:

   -> HUMAN_REVIEW

6. Instructor claims review

   POST /api/v1/reviews/:id/claim

7. Instructor decides

   POST /api/v1/reviews/:id/decision

8. Student retrieves result

   GET /api/v1/evaluations/:id
```

---

# 54. API Design Principles Summary

The API is designed around a simple responsibility model:

```
API
  |
  +---- Validate
  +---- Authorize
  +---- Persist
  +---- Queue
  +---- Respond

Worker
  |
  +---- Process
  +---- Evaluate
  +---- Retry
  +---- Persist Result

Database
  |
  +---- Source of Truth
  +---- Constraints
  +---- Relationships

Queue
  |
  +---- Async Delivery

LLM
  |
  +---- Evaluation Intelligence
```

This separation keeps HTTP requests responsive while allowing the evaluation pipeline to scale independently.
