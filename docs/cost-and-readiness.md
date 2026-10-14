# Deployment Readiness and Cost Review

Review date: 2026-10-14. Nothing has been deployed. Prices are **estimates** for a tiny demo and must be re-checked on the AWS pricing pages and the AWS Pricing Calculator for your region and account before deploying.

## 1. Resources the template creates (22 CloudFormation resources)

Verified by expanding `template.yaml` offline with the SAM translator (no AWS access).

| # | Resource type | Logical ID(s) | Billing model |
|---|---|---|---|
| 1 | `AWS::Cognito::UserPool` (Lite tier) | UserPool | per monthly active user, 10,000 free (Lite) |
| 1 | `AWS::Cognito::UserPoolClient` | UserPoolClient | free |
| 1 | `AWS::DynamoDB::Table` (on-demand) | TasksTable | per request + storage over 25 GB |
| 1 | `AWS::ApiGateway::RestApi` | TaskApi | per request |
| 1 | `AWS::ApiGateway::Stage` / `Deployment` | TaskApiStage, TaskApiDeployment... | free (cache and tracing off) |
| 4 | `AWS::Lambda::Function` (python3.12, arm64, 128 MB, 10 s) | Create/List/Update/DeleteTaskFunction | per request + GB-second |
| 4 | `AWS::IAM::Role` | one per function | free |
| 4 | `AWS::Lambda::Permission` | API Gateway -> Lambda invoke | free |
| 4 | `AWS::Logs::LogGroup` (7-day retention) | Create/List/Update/DeleteTaskLogGroup | per GB ingested + stored |

**Not created:** WAF, CloudFront, S3 hosting, X-Ray (tracing off), API Gateway cache cluster, KMS keys, NAT gateways, VPCs, SES/SNS, Budgets.

**Created outside the template by `sam deploy --resolve-s3`:** a SAM-managed stack `aws-sam-cli-managed-default` with one S3 bucket that holds the Lambda zip files (a few KB-MB; effectively free, but it must be cleaned up separately, see `deployment.md`).

## 2. What can generate charges

| Service | Charge driver | At demo scale | Risk |
|---|---|---|---|
| API Gateway (REST) | ~$3.50 per million requests (us-east-1 list price, checked on the pricing page) | cents | Only grows with traffic. Throttle caps it at 10 req/s steady, 20 burst. |
| Lambda | $0.20 per million requests + GB-seconds | well under a cent | Low |
| DynamoDB on-demand | per million read/write request units; storage over 25 GB | well under a cent | Low |
| Cognito | per MAU above 10,000 free (Lite) | $0 | Low. Email verification uses Cognito's built-in sender (no SES charge, ~50 emails/day limit). Never enable SMS/MFA-by-SMS: those are billed separately. |
| CloudWatch Logs | ~$0.50/GB ingested, 5 GB/month free allowance (pricing page; storage rate not verified) | cents | **Fixed:** retention is now 7 days. Previously Lambda would have created never-expiring groups. |
| Data transfer out | free for the first 100 GB/month to the internet (verify) | $0 | Low |
| S3 (SAM artifacts) | storage + requests | pennies | Low, but leftover if not cleaned up |

Idle cost: all services are pay-per-use; with no traffic the stack should cost approximately nothing. That is not a guarantee.

## 3. Unexpected-cost check

| Item | Result |
|---|---|
| WAF / CloudFront / X-Ray / API cache | Not enabled (`EnableXRay`, `EnableApiCache` default `'false'`; WAF/CloudFront not defined). |
| **DynamoDB `SSEEnabled: true`** | **Found and fixed.** It selects the AWS-managed KMS key and adds KMS request charges. Removed. DynamoDB is still always encrypted at rest with an AWS-owned key at no cost. |
| Cognito tier | **Fixed.** New pools default to Essentials; template now sets `UserPoolTier: LITE` (cheaper above the free tier; same 10,000 free MAU). |
| Log retention | **Fixed.** Four explicit log groups with `RetentionInDays: 7` (parameter `LogRetentionDays`, allowed values 1-90). Functions use them via `LoggingConfig`. |
| DynamoDB PITR | Off (on would add cost). Enable for real production use. |
| API Gateway access/execution logging | Not enabled (would add CloudWatch cost and needs an account-level role). |
| Provisioned concurrency / reserved concurrency | None. |

## 4. Estimated monthly cost, tiny demo

Assumption: 5 users, about 2,000 API requests per month, each Lambda ~100 ms at 128 MB, ~1 MB of logs. Rates are approximate us-east-1 list prices; the Lambda and DynamoDB rates are from public pricing as I know it and were **not re-verified** in this session.

| Service | Quantity | List price (no free tier at all) |
|---|---|---|
| API Gateway | 2,000 requests | ~$0.007 |
| Lambda | 2,000 requests, ~25 GB-s | ~$0.001 |
| DynamoDB | ~700 writes, ~1,300 reads, KBs stored | ~$0.001 |
| Cognito Lite | 5 MAU | $0 (within 10,000 free MAU) |
| CloudWatch Logs | ~1 MB ingested | ~$0.001 |
| S3 artifacts | a few MB | ~$0.001 |
| **Total** | | **roughly $0.01 - $0.05 per month** |

### Free Tier assumptions (separate from the numbers above)
- Do **not** assume your account qualifies. AWS says accounts created from 15 July 2025 get a free plan or paid plan with up to $200 in credits and a 6-month window (the free plan is limited to select services, so check that API Gateway and Cognito are usable on it, or choose the paid plan). Older accounts may still have the 12-month Free Tier (e.g. 1 million API Gateway REST calls per month for new customers). Check the Billing console, "Free Tier" page.
- Cognito's 10,000 free MAU does not expire and is per account/organisation. Legacy pools created before 22 Nov 2024 had 50,000; this pool is new.
- Lambda and DynamoDB have monthly allowances that are separate from the 12-month trial; check the current terms.

### Possible charges beyond the demo
- Traffic abuse: the API URL is public. Unauthenticated calls are rejected by the Cognito authorizer, but I have not verified whether those are billed. Theoretical ceiling if someone sustained the throttle limit (10 req/s) all month: about 26 million requests, roughly $90 in API Gateway fees alone. Mitigations: keep the throttle low, delete the stack after the demo, set a budget alert.
- Forgetting the stack and the SAM artifact bucket.
- Enabling optional services later (WAF has a monthly fee per web ACL and rules, CloudFront, X-Ray, API cache which bills hourly).
- Free Tier / credits expiring or being exhausted.

I cannot promise zero cost. Create an **AWS Budget** (e.g. $5) with email alerts before deploying.

## 5. Security review

| Area | Finding |
|---|---|
| Authentication | Cognito User Pool, SRP flow only (`ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`); no client secret (public SPA); user-existence errors hidden; token revocation on. |
| Authorizer | All four methods have the Cognito authorizer (header `Authorization`, ID token). OPTIONS preflight is unauthenticated by design. Verified in the expanded OpenAPI. |
| Authorisation | Lambda uses only the verified `sub` claim as `userId`; every DynamoDB call is keyed by it; covered by 74 tests including cross-user isolation. |
| IAM | One inline statement per function, one DynamoDB action each (PutItem, Query, UpdateItem, DeleteItem), scoped to the single table ARN. Plus `AWSLambdaBasicExecutionRole` (log writing). **Minor:** SAM also attaches `AWSXrayWriteOnlyAccess` to each role because tracing is a template parameter; it is harmless and free while tracing is off, and could be removed by dropping the `EnableXRay` parameter. |
| CORS | Single origin from `FrontendOrigin`, wildcard now rejected by `AllowedPattern`. **Fixed:** API Gateway `DEFAULT_4XX`/`DEFAULT_5XX` responses now carry the CORS header, otherwise authorizer 401s would show up in the browser as opaque CORS errors. |
| Environment variables | `TABLE_NAME`, `LOG_LEVEL`, `ALLOWED_ORIGIN` only; no secrets. |
| Encryption | In transit: HTTPS only (API Gateway). At rest: DynamoDB AWS-owned key. |
| Throttling | 10 req/s steady, 20 burst on all methods. |
| Residual risks | Public API URL; passwords policy is basic (min 8, no symbols); no MFA; no WAF (deliberately); no PITR/backups; tokens kept in browser localStorage by the Cognito SDK; the demo stack should not hold real personal data. |

## 6. Changes made to `template.yaml` in this step

1. Cognito `UserPoolTier: LITE`, `DeletionProtection: INACTIVE`; client `EnableTokenRevocation: true`.
2. Removed DynamoDB `SSESpecification` (avoids KMS charges); explicit `DeletionProtectionEnabled: false`.
3. Added 4 `AWS::Logs::LogGroup` with `RetentionInDays: !Ref LogRetentionDays` and wired them with `LoggingConfig`.
4. `LogRetentionDays` restricted to valid CloudWatch values; `FrontendOrigin` rejects wildcards.
5. API Gateway `GatewayResponses` add the CORS header to 4XX/5XX.
6. Updated the description.

## 7. Verification done (all local, no AWS access)

- `sam validate --lint`: valid.
- `sam build`: succeeds (Python 3.12 packaging of `backend/src`).
- Offline translation to CloudFormation: 22 resources, none of WAF/CloudFront/X-Ray/cache/S3.
- Backend tests: 74 passed. Frontend tests: 25 passed.
