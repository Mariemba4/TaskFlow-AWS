# TaskFlow - Submission Summary

**Project:** TaskFlow - Secure Serverless Task Management Application
**Programme:** AWS Solutions Architect Associate graduation project (Manara)

## Deployment status: NOT DEPLOYED

No AWS resources were created, no AWS credentials were configured, and no AWS account was used. The application runs locally; the AWS architecture is designed, defined as code and validated, but it is **planned, not running**. Nothing in this repository claims otherwise.

## Goal

Demonstrate a secure, cost-conscious serverless architecture on AWS with a working To-Do application: users register and sign in, then create, list, update the status of and delete **their own** tasks, with other users' data inaccessible.

## What is implemented (and verified locally)

| Area | Implementation | Evidence |
|---|---|---|
| Backend | 4 Python 3.12 Lambda handlers (`POST/GET /tasks`, `PUT/DELETE /tasks/{taskId}`), DynamoDB via boto3, UUID task ids, UTC timestamps, input validation, generic error responses | 74 pytest tests with moto (mocked DynamoDB): CRUD, invalid and malformed input, missing auth claims, user isolation, nonexistent tasks |
| Authorisation logic | `userId` taken only from the verified Cognito `sub` claim; partition key `userId`; conditional update/delete; other users' tasks return `404` | Cross-user isolation tests |
| Frontend | React + Vite SPA: login/register/confirm pages, task dashboard (create, edit, complete, delete, filter), loading / empty / error states, responsive and accessible | 25 Vitest tests, production build, browser-verified in Chrome (see screenshots) |
| API client and Cognito integration | Reusable API client (401/404/500 handling, ID token in `Authorization`) and Cognito User Pool sign-up / sign-in / confirm code | Unit-tested with mocks; **not run against real Cognito** |
| Local demo mode | Fake demo user, `localStorage` only, cannot call AWS | Tests assert `fetch` is never called; default mode |
| Infrastructure as code | AWS SAM template, 22 resources, cost-conscious parameters | `sam validate --lint` and `sam build` pass |
| Documentation | Architecture diagram (editable + PNG), security and cost review, deployment and teardown procedure | [docs/](.) |

## What is designed but NOT deployed

Defined in [`template.yaml`](../template.yaml); none of it exists in AWS:

- Amazon Cognito User Pool (Lite tier) and app client (SRP, no secret)
- Amazon API Gateway REST API with a Cognito authorizer on all four methods, throttling (10 req/s, burst 20), single-origin CORS
- 4 AWS Lambda functions (python3.12, arm64, 128 MB), each with its own least-privilege IAM role (one DynamoDB action on one table)
- Amazon DynamoDB table (on-demand, key `userId` + `taskId`)
- 4 Amazon CloudWatch log groups with 7-day retention

**Not part of the design:** WAF, CloudFront, S3 frontend hosting, X-Ray, API Gateway caching. They are documented as optional extensions and are off or absent.

## Architecture and AWS concepts demonstrated

![Architecture](architecture.png)

| Well-Architected pillar | How TaskFlow addresses it |
|---|---|
| Security | Cognito identity, API-level authorizer, partition-key data isolation, least-privilege IAM per function, encryption at rest, input validation, no secrets in code or configuration, generic error messages |
| Cost optimisation | Pay-per-use services only, on-demand DynamoDB, arm64 and small Lambda memory, finite log retention, Cognito Lite tier, DynamoDB without KMS charges, paid options disabled, teardown procedure |
| Reliability | Managed, multi-AZ regional services; API throttling; conditional writes |
| Performance efficiency | Serverless scaling; single-table key design that fits the access patterns |
| Operational excellence | Infrastructure as code (SAM), CloudWatch logs, automated tests, reproducible local checks |

## How to verify (no AWS account needed)

Requires Python 3.12 and Node.js 22 LTS (22.22.2 or later; the test tooling needs it).

```powershell
# Backend tests and template validation (from the repository root)
python -m venv .venv ; .\.venv\Scripts\Activate.ps1 ; pip install -r requirements.txt
python -m pytest backend/tests -q        # 74 passed
sam validate --lint                       # valid SAM template

# Frontend demo, tests and build
cd frontend
npm install
npm test                                  # 25 passed
npm run build
npm run dev                               # http://localhost:5173 -> "Continue as demo user"
```

## Cost position

Estimated list-price cost of a tiny demo is roughly $0.01-$0.05 per month before any Free Tier or credits; this is an estimate, not a guarantee, and Free Tier eligibility depends on the account. Because the student chose not to incur charges, the stack has deliberately not been deployed. See [cost-and-readiness.md](cost-and-readiness.md).

## Honest limitations

- The integration between the frontend, real Cognito and API Gateway has not been exercised; it is covered only by mocked unit tests.
- Real-world behaviour of the deployed stack (CORS, authorizer, email verification, latency) is unverified.
- No CI pipeline, backups, MFA or WAF (WAF and CloudFront are deliberately excluded for cost).
- Cost figures are estimates and must be re-checked against current AWS pricing.

## Optional next step

Deploy to the student's own AWS account following [deployment.md](deployment.md), run the smoke tests, capture console screenshots and delete the stack with `sam delete`.
