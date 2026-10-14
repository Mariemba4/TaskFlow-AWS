# Deployment and Teardown (Windows PowerShell)

> These commands have **not** been run. Read `cost-and-readiness.md` first. You run them, with your own AWS credentials. Never commit credentials, and never paste secret keys into chat or files in this repo.

Replace `eu-west-1` with the region you choose. Run everything from the repo root.

## 0. One-time prerequisites

```powershell
# AWS CLI (not installed on this machine yet)
winget install Amazon.AWSCLI          # then open a NEW terminal

# Configure credentials yourself. Prefer IAM Identity Center (SSO):
aws configure sso
# or, with an IAM user's access key (least privilege, no root keys):
# aws configure

# Confirm you are in the account you expect
aws sts get-caller-identity
```

Create a cost safety net in the console: **Billing -> Budgets -> Create budget** (cost budget, e.g. $5/month, email alert at 50% and 100%). Also check **Billing -> Free Tier** to see what your account actually includes.

## 1. Pre-flight checks (local, free)

```powershell
$env:SAM_CLI_TELEMETRY = "0"
.\.venv\Scripts\Activate.ps1
python -m pytest backend/tests -q
sam validate --lint
sam build
```

## 2. Deploy

```powershell
$Region = "eu-west-1"
$Stack  = "taskflow-dev"

sam deploy `
  --stack-name $Stack `
  --region $Region `
  --resolve-s3 `
  --capabilities CAPABILITY_IAM `
  --confirm-changeset `
  --parameter-overrides Stage=dev FrontendOrigin=http://localhost:5173 LogRetentionDays=7 EnableXRay=false EnableApiCache=false
```

`--confirm-changeset` shows the list of resources and asks before creating anything; compare it with the 22 resources in `cost-and-readiness.md`. `--resolve-s3` creates the SAM-managed artifact bucket (see teardown).

## 3. Read the outputs and configure the frontend

```powershell
aws cloudformation describe-stacks --stack-name $Stack --region $Region `
  --query "Stacks[0].Outputs" --output table
```

Create `frontend/.env.local` (git-ignored):

```
VITE_DEMO_MODE=false
VITE_API_URL=<ApiUrl output>
VITE_COGNITO_USER_POOL_ID=<UserPoolId output>
VITE_COGNITO_CLIENT_ID=<UserPoolClientId output>
VITE_AWS_REGION=eu-west-1
```

```powershell
cd frontend; npm run dev
```

## 4. Smoke tests

```powershell
$Api = "<ApiUrl output>"

# Must be 401: proves the authorizer protects the API (no token)
try { Invoke-WebRequest "$Api/tasks" -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
```

Then in the app: register with a real email you own, enter the verification code, sign in, create/complete/edit/delete a task. Check the logs and retention:

```powershell
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/taskflow-dev `
  --region $Region --query "logGroups[].[logGroupName,retentionInDays]" --output table
```

## 5. Teardown: delete everything after the demo

```powershell
# 1. Delete the application stack (Cognito pool + users, DynamoDB table + data, API, Lambdas, roles, log groups)
sam delete --stack-name $Stack --region $Region

# 2. Verify it is gone
aws cloudformation describe-stacks --stack-name $Stack --region $Region   # should report it does not exist
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/taskflow-dev --region $Region

# 3. Optional: remove the SAM-managed artifact bucket stack (only if no other SAM project uses it)
$Bucket = aws cloudformation describe-stack-resources --stack-name aws-sam-cli-managed-default `
  --region $Region --query "StackResources[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId" --output text
aws s3 rm "s3://$Bucket" --recursive          # versioned bucket: also delete old versions in the console if it refuses
aws cloudformation delete-stack --stack-name aws-sam-cli-managed-default --region $Region
```

`sam delete` also removes the uploaded artifacts it created. Also remove `frontend/.env.local` (or set `VITE_DEMO_MODE=true`). After 1-2 days check **Billing -> Cost Explorer** to confirm no charges are still accruing, and delete the Budget if you no longer need it.

## Troubleshooting

- `CAPABILITY_IAM` error: the flag above is required because SAM creates IAM roles.
- Browser shows a CORS error: `FrontendOrigin` must exactly equal the page origin (scheme + host + port). Redeploy with the right value.
- 401 from the app after sign-in: the API expects the Cognito **ID token** (the frontend already sends it).
- Stack stuck in `ROLLBACK_COMPLETE`: run `sam delete` and deploy again.
