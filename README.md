# TaskFlow - Secure Serverless Task Management Application

A To-Do web application built to demonstrate a **secure, cost-conscious serverless architecture on AWS**: React frontend, Amazon Cognito authentication, API Gateway, Python Lambda, DynamoDB and CloudWatch, defined as code with AWS SAM.

> Graduation project for the **AWS Solutions Architect Associate** programme (Manara).

> ### Deployment status: NOT DEPLOYED
> No AWS resources have been created and no AWS account or credentials were used to build this project. The application runs fully **locally** (demo mode, mocked DynamoDB in tests). The AWS architecture is designed, defined in [`template.yaml`](template.yaml) and validated with `sam validate --lint`, but it is **planned, not running**. Deployment is optional and documented in [docs/deployment.md](docs/deployment.md).

## Contents

[Objectives](#objectives) | [Status](#project-status) | [Architecture](#architecture) | [AWS services](#aws-services) | [Security](#security-design) | [Screenshots](#screenshots) | [Run the demo](#run-the-local-demo) | [Testing](#testing) | [API](#api-reference) | [Deployment (optional)](#aws-deployment-optional-not-executed) | [Cost](#cost-considerations) | [Structure](#project-structure) | [Documentation](#documentation)

## Objectives

- Design a three-tier serverless application using core Solutions Architect Associate services.
- Enforce **per-user data isolation** end to end: Cognito identity, API authorizer, partition-key scoping and least-privilege IAM.
- Keep the design **Free Tier friendly and cost-aware**: pay-per-use services only, optional paid components disabled and documented.
- Treat infrastructure as code (AWS SAM) and prove correctness with automated tests that need no AWS account.

**Features:** register / sign in, create, list, edit, complete and delete personal tasks, with strict isolation between users.

## Project status

| Component | Status |
|---|---|
| React + Vite frontend (login/register UI, task dashboard, responsive) | Implemented, tested, runs locally |
| Local demo mode (fake user, `localStorage`, no AWS calls) | Implemented, tested, runs locally |
| Python 3.12 Lambda handlers (create / list / update / delete) | Implemented, tested locally against mocked DynamoDB |
| AWS SAM template (`template.yaml`) | Written and validated (`sam validate --lint`, `sam build`); **not deployed** |
| Cognito, API Gateway, Lambda, DynamoDB, CloudWatch, IAM in AWS | **Planned. Nothing is deployed.** |
| Frontend connected to a real Cognito user pool and API | Code written, **never run against AWS** (needs a deployment) |
| Architecture diagram, security and cost review | Done ([docs/](docs/)) |
| WAF, CloudFront, S3 hosting, X-Ray, API caching | Not part of the design (documented as optional extensions) |

## Architecture

![TaskFlow architecture diagram](docs/architecture.png)

*Editable source: [docs/architecture.drawio](docs/architecture.drawio) (open at [app.diagrams.net](https://app.diagrams.net) or with the VS Code draw.io extension). The diagram shows what runs today in green (solid) and the planned AWS resources dashed in orange.*

**In one paragraph.** A React single-page app runs in the user's browser and signs users in with an Amazon Cognito User Pool. Cognito returns JWT tokens; the app sends the **ID token** in the `Authorization` header of every call to an API Gateway REST API. API Gateway's built-in Cognito authorizer validates the token before anything else runs, then invokes one of four small Python Lambda functions (create, list, update, delete). Each function talks to a single DynamoDB table, using the user's Cognito `sub` as the partition key so users can only ever touch their own items, and writes logs to its own CloudWatch log group with 7-day retention. Each function runs under its own IAM role that allows exactly one DynamoDB action on that one table.

### Request flow

| Step | What happens |
|---|---|
| 1 | The browser signs up or signs in with Cognito (SRP, the password is never sent in clear). Cognito returns ID, access and refresh tokens. |
| 2 | The browser calls `https://<api>/<stage>/tasks...` with `Authorization: <ID token>`. |
| 3 | API Gateway's Cognito authorizer validates the token against the user pool. Missing or invalid token: `401`, no Lambda is invoked. |
| 4 | For a valid token, API Gateway invokes the Lambda for the route: `POST /tasks`, `GET /tasks`, `PUT /tasks/{taskId}`, `DELETE /tasks/{taskId}`. The verified claims, including `sub`, arrive in the event. |
| 5 | The Lambda takes `userId` from `claims.sub` (never from the request body or query string) and reads or writes only items with that partition key. |
| 6 | The Lambda logs to CloudWatch Logs and returns JSON; the response travels back the same way. |

In demo mode (the default) the browser uses a fake local user and `localStorage` instead, with no network calls to AWS.

## AWS services

All of these are **planned** resources defined in `template.yaml` (22 CloudFormation resources in total).

| Service | Role in TaskFlow | Cost posture |
|---|---|---|
| Amazon Cognito User Pools (Lite tier) | Registration, sign-in, JWT issuance | 10,000 free monthly active users |
| Amazon API Gateway (REST API) | HTTPS endpoint, Cognito authorizer, throttling (10 req/s, burst 20), CORS | Pay per request; Free Tier only if your account qualifies |
| AWS Lambda (Python 3.12, arm64, 128 MB) | Four CRUD functions | Pay per request and duration; monthly free allowance |
| Amazon DynamoDB (on-demand) | Task storage; key `userId` + `taskId` | Pay per request; no idle cost |
| Amazon CloudWatch Logs | 4 log groups, 7-day retention | Pay per GB ingested; 5 GB/month free allowance |
| AWS IAM | One least-privilege execution role per function | Free |
| AWS SAM / CloudFormation | Infrastructure as code | Free |
| *Optional, not included:* WAF, CloudFront, S3 hosting, X-Ray, API caching | Hardening and performance | Off by default (paid); see [docs/cost-and-readiness.md](docs/cost-and-readiness.md) |

## Security design

Defence in depth, layer by layer (defined in `template.yaml` and the backend code, verified by tests where possible):

| Layer | Control |
|---|---|
| Identity | Cognito User Pool, SRP sign-in only, no client secret in the SPA, user-existence errors hidden, token revocation enabled. |
| Edge | HTTPS only (API Gateway); Cognito authorizer on all four methods (only the CORS preflight `OPTIONS` is open); throttling of 10 req/s with burst 20; single-origin CORS, wildcards rejected by the template. |
| Authorisation | `userId` always comes from the verified JWT `sub`; a `userId` in the body or query string is ignored. The DynamoDB partition key is `userId`, and update/delete use a condition on the existing item, so another user's task returns `404` (existence is not leaked). Covered by cross-user tests. |
| Input | Titles 1-200 characters, status limited to `todo` / `in_progress` / `done`, UUID task ids, JSON object bodies under 10 KB. |
| Errors | Controlled messages only; unexpected errors return a generic `500` and are logged to CloudWatch, never returned to the client. |
| IAM | One execution role per function with a single DynamoDB action (`PutItem`, `Query`, `UpdateItem`, `DeleteItem`) on the single table ARN. No wildcard resources. |
| Data | Encrypted at rest (DynamoDB AWS-owned key). No secrets in environment variables (`TABLE_NAME`, `LOG_LEVEL`, `ALLOWED_ORIGIN` only) or in the repository; frontend configuration contains public identifiers only. |
| Logging | Explicit CloudWatch log groups with finite retention. |

Residual risks (public API URL, basic password policy, no MFA, no WAF by design, tokens in browser storage, no backups) are listed in [docs/cost-and-readiness.md](docs/cost-and-readiness.md).

## Screenshots

Captured from the production build of the frontend running locally in **demo mode** (generic sample data, no AWS). There are no AWS console screenshots because nothing is deployed.

| Demo entry | Dashboard with tasks |
|---|---|
| ![Demo mode entry page](docs/screenshots/01-demo-entry.png) | ![Dashboard with tasks in three statuses](docs/screenshots/03-dashboard-tasks.png) |

| Empty state | Mobile layout |
|---|---|
| ![Empty dashboard](docs/screenshots/02-dashboard-empty.png) | ![Responsive mobile dashboard](docs/screenshots/04-mobile.png) |

## Run the local demo

No AWS account, credentials or internet services are needed. Requires **Node.js 20+** (22 LTS recommended).

```powershell
cd frontend
npm install
npm run dev          # open http://localhost:5173
```

Click **Continue as demo user**, then add, edit, complete and delete tasks. Demo mode is the default when `frontend/.env.local` does not exist. Tasks are stored in your browser's `localStorage` under the `taskflow-demo:` prefix; the demo uses a fake user (`demo@taskflow.local`), asks for no credentials, and its code path has no URL, token or AWS SDK usage, so it cannot reach AWS. A "Demo mode" banner is always visible.

### Switching to AWS mode (only after you deploy the stack)

1. Deploy the stack yourself (see below) and note the outputs `ApiUrl`, `UserPoolId`, `UserPoolClientId`.
2. Copy `frontend/.env.example` to `frontend/.env.local` (git-ignored) and set:
   ```
   VITE_DEMO_MODE=false
   VITE_API_URL=<ApiUrl>
   VITE_COGNITO_USER_POOL_ID=<UserPoolId>
   VITE_COGNITO_CLIENT_ID=<UserPoolClientId>
   VITE_AWS_REGION=<region>
   ```
3. Restart `npm run dev`. Registration (with email verification code), sign-in and the task API now use Cognito and API Gateway. The ID token is sent in the `Authorization` header and is never logged.

If AWS mode is on but a variable is missing, the app shows a configuration error. It never silently falls back to demo mode, and demo mode never falls back to AWS. `FrontendOrigin` in the stack must match your frontend URL for CORS.

## Testing

All tests run locally and need **no AWS account or credentials** (DynamoDB is mocked with moto; dummy credentials are forced in the test setup).

```powershell
# Backend (from the repository root)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pytest backend/tests -q       # 74 tests: CRUD, validation, auth claims, user isolation, 404s, malformed input

# Template validation (no AWS access needed)
sam validate --lint
sam build

# Frontend
cd frontend
npm test                                # 25 tests (Vitest + Testing Library): API client, demo store, UI flows
npm run build                           # production build
npm audit                               # dependency vulnerabilities
```

The backend tests cover create, list, update and delete, invalid and boundary input, missing or malformed authentication claims, cross-user isolation, nonexistent tasks, malformed requests and error-message hygiene.

## API reference

All endpoints require `Authorization: <Cognito ID token>`. The caller's identity is always the token's `sub` claim.

| Method | Path | Description | Success |
|---|---|---|---|
| POST | `/tasks` | Create a task | `201` + task |
| GET | `/tasks` | List my tasks (newest first) | `200` `{"tasks": [...]}` |
| PUT | `/tasks/{taskId}` | Update `title` and/or `status` | `200` + task |
| DELETE | `/tasks/{taskId}` | Delete a task | `204` |

**Task:** `{ userId, taskId (UUID), title (1-200 chars), status: todo | in_progress | done, createdAt, updatedAt }` (UTC ISO-8601).

**Errors:** `400` invalid input or malformed JSON / taskId, `401` missing identity, `404` task not found *or owned by someone else*, `500` generic message (details only in CloudWatch).

Example requests (they work only after a deployment; replace the placeholders):

```bash
API=https://<api-id>.execute-api.<region>.amazonaws.com/dev
TOKEN=<cognito-id-token>

curl -X POST $API/tasks -H "Authorization: $TOKEN" -H "Content-Type: application/json" -d '{"title": "Write report"}'
curl $API/tasks -H "Authorization: $TOKEN"
curl -X PUT $API/tasks/<taskId> -H "Authorization: $TOKEN" -H "Content-Type: application/json" -d '{"status": "done"}'
curl -X DELETE $API/tasks/<taskId> -H "Authorization: $TOKEN"
```

## AWS deployment (optional, not executed)

> **These steps have not been run.** Deploying creates AWS resources in your own account and **may incur charges**. Read [docs/cost-and-readiness.md](docs/cost-and-readiness.md) first, set an AWS Budget alert, and use your own credentials (never commit them).

The reviewed, step-by-step procedure for Windows PowerShell, including smoke tests and a **complete teardown**, is in [docs/deployment.md](docs/deployment.md). In outline:

```powershell
sam validate --lint
sam build
sam deploy --stack-name taskflow-dev --region <region> --resolve-s3 --capabilities CAPABILITY_IAM --confirm-changeset `
  --parameter-overrides Stage=dev FrontendOrigin=http://localhost:5173 LogRetentionDays=7
# ... use it, then delete everything:
sam delete --stack-name taskflow-dev --region <region>
```

## Cost considerations

- Every service is on-demand / pay-per-use; there are no always-on resources, so idle cost is approximately nothing.
- Paid options (`EnableApiCache`, `EnableXRay`, WAF, CloudFront) are disabled or not defined.
- Cost controls in the template: explicit 7-day log retention, arm64 Lambda at 128 MB, Cognito Lite tier, DynamoDB without KMS charges, API throttling.
- Estimate for a tiny demo (about 2,000 requests a month): roughly **$0.01-$0.05 per month at list price before any Free Tier or credits**. This is an estimate, not a guarantee; Free Tier eligibility depends on the account, and the API URL is public, so set a budget alert and delete the stack after use. Details and assumptions: [docs/cost-and-readiness.md](docs/cost-and-readiness.md).

## Project structure

```
TaskFlow-AWS/
├── README.md
├── LICENSE                    # MIT
├── template.yaml              # AWS SAM template (22 resources, not deployed)
├── requirements.txt           # Local dev/test tooling (SAM CLI, boto3, pytest, moto)
├── backend/
│   ├── src/
│   │   ├── handlers/          # create_task, list_tasks, update_task, delete_task
│   │   ├── common/            # auth, db, http (error handling), responses, validation
│   │   └── requirements.txt   # Lambda runtime dependencies (none needed)
│   └── tests/                 # pytest + moto
├── frontend/
│   ├── src/
│   │   ├── config.js          # env parsing, demo vs AWS selection
│   │   ├── services/          # apiClient, cognitoAuth, demo store (no React)
│   │   ├── hooks/             # useTasks
│   │   ├── components/        # AuthPage, Dashboard, TaskItem, StatusBadge, Alert
│   │   └── test/              # test setup
│   ├── .env.example           # public configuration template (no secrets)
│   └── package.json
└── docs/
    ├── architecture.drawio    # editable diagram
    ├── architecture.png       # exported diagram
    ├── cost-and-readiness.md  # resources, cost estimate, security review
    ├── deployment.md          # optional deploy + teardown procedure (not executed)
    ├── submission.md          # summary for the Manara submission
    └── screenshots/           # local demo screenshots
```

## Documentation

| Document | Contents |
|---|---|
| [docs/submission.md](docs/submission.md) | Concise summary: what is implemented, what is planned, how to verify |
| [docs/cost-and-readiness.md](docs/cost-and-readiness.md) | Resource list, cost estimate with assumptions, security findings |
| [docs/deployment.md](docs/deployment.md) | Optional deployment and full teardown (not executed) |
| [docs/architecture.drawio](docs/architecture.drawio) | Editable architecture diagram |

## Limitations and possible next steps

- Not deployed; the frontend has never been exercised against real Cognito or API Gateway.
- Possible extensions (not implemented, not deployed): S3 + CloudFront hosting, WAF, X-Ray, API caching, MFA, DynamoDB backups, a CI pipeline.

## License

Released under the [MIT License](LICENSE). This is an educational graduation project.
