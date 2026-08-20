# Deploying superstruct-user

End-to-end runbook: from an empty AWS account to a fully working stack, plus
day-2 operations and teardown. Architecture background is in the
[README](../README.md).

## What gets deployed

| Piece | Tool | Region |
| --- | --- | --- |
| Terraform state bucket | Terragrunt (auto-bootstrap) | eu-central-1 |
| Security Hub CSPM, GitHub OIDC, KMS CMK (+ us-east-1 replica) | Terragrunt (`infrastructure/dev/00–21`) | eu-central-1 / us-east-1 |
| API: Lambda, HTTP API, DynamoDB, secrets, audit pipeline | oss-serverless (`services/user-api`) | eu-central-1 |
| CloudFront + WAF edge | Terragrunt (`30-edge`) | us-east-1 |
| Amplify hosting (WEB_COMPUTE, git-connected Astro SSR builds) | Terragrunt (`40-frontend-hosting`) | eu-central-1 |

## Prerequisites

- **Tools**: node ≥ 22 + npm, Terragrunt ≥ 1.0, OpenTofu (or Terraform ≥ 1.10),
  AWS CLI v2, python3, zip, curl. For CI setup: the `gh` CLI.
- **AWS**: an account with AdministratorAccess credentials, e.g. an SSO
  profile. All commands below assume `AWS_PROFILE` is exported.
- **Config**: set the account ID and region in `infrastructure/dev/env.hcl` —
  the single source of truth every unit reads.
- **GitHub token for Amplify**: a fine-grained PAT with this repo selected and
  permissions **Contents: read** + **Webhooks: read/write** (or a classic PAT
  with `repo` + `admin:repo_hook`), stored once as a SecureString (it also
  lands in the hosting unit's Terraform state):
  `aws ssm put-parameter --name /superstruct-user/dev/github-token --type SecureString --value <PAT>`

```sh
npm install          # workspaces
export AWS_PROFILE=<your-profile>
```

## Fresh-account bootstrap

Ordering matters only on the very first deploy, because two seams cross tool
boundaries: `30-edge` reads the API stack's `ApiDomain` output, and the API's
CORS reads the Amplify URL from SSM.

```sh
cd infrastructure/dev

# 1. State bucket + every unit that does not need the API stack yet.
for unit in 00-security-hub 10-github-oidc-provider 11-github-actions-role \
            20-kms 21-kms-replica; do
  (cd "$unit" && terragrunt apply --backend-bootstrap)
done

# 2. The API stack. Deploys standalone (CORS falls back to a localhost
#    origin until the Amplify unit exists).
cd ../.. && npm run deploy:api

# 3. Edge, then Amplify hosting (depends on the edge API URL; needs the
#    github-token SSM parameter from the prerequisites).
cd infrastructure/dev && terragrunt run --all apply

# 4. Redeploy the API so CORS picks up the real Amplify origin, then trigger
#    the first frontend build.
cd ../.. && npm run deploy:api
APP_ID=$(aws ssm get-parameter --name /superstruct-user/dev/frontend/app-id \
  --region eu-central-1 --query Parameter.Value --output text)
aws amplify start-job --app-id "$APP_ID" --branch-name main --job-type RELEASE --region eu-central-1
```

Notes:

- `--backend-bootstrap` is only needed once, to create the state bucket.
- Step 3's CloudFront distribution takes 5–10 minutes to create; the first
  Amplify build takes a few minutes more.
- If you ran `deploy:api` *before* the KMS units ever existed, run it again
  after step 1 so the secrets switch from the AWS-managed key to the CMK.

## Verify

```sh
API=$(aws ssm get-parameter --name /superstruct-user/dev/edge/api-url \
  --region eu-central-1 --query Parameter.Value --output text)
APP=$(aws ssm get-parameter --name /superstruct-user/dev/frontend/app-url \
  --region eu-central-1 --query Parameter.Value --output text)

curl -s $API/v1/stats                          # {"totalUsers":0}
curl -s -o /dev/null -w '%{http_code}\n' $APP  # 200
```

Register + login through the frontend (`$APP`) or with curl against
`$API/v1/register` / `/v1/login` — see the API table in the README.

## CI/CD (GitHub Actions)

Pushes to `main` run `.github/workflows/deploy.yml`: checks (lint, typecheck,
tests) gate `terragrunt run --all apply` followed by the API deploy. Auth is
GitHub OIDC — no AWS keys in GitHub.

One-time setup for a new repo or account:

1. Update `oidc_subjects` in `infrastructure/dev/11-github-actions-role/terragrunt.hcl`.
   GitHub mints **immutable-reference** subjects — `repo:OWNER@ownerId/REPO@repoId:ref:...`,
   *not* the classic `repo:owner/repo:ref:...`. Get the IDs from
   `gh api /users/<owner> --jq .id` and `gh api /repos/<owner>/<repo> --jq .id`.
2. Apply `10-github-oidc-provider` and `11-github-actions-role`.
3. Set `DEPLOY_ROLE_ARN` and `AWS_REGION` in the workflow's `env` block.
4. Pushing workflow files requires the `workflow` scope on your gh token:
   `gh auth refresh -s workflow`.

The frontend is built by Amplify itself on every push to `main` (git-connected
app, auto-build enabled) — independent of the Actions workflow.

## Day-2 operations

```sh
npm test / npm run lint / npm run typecheck    # local checks (CI runs the same)
npm run deploy:api                             # API only
terragrunt apply                               # single unit, run inside its directory
terragrunt run --all apply                     # whole infra tree (from infrastructure/dev)
terragrunt hcl format && terraform fmt -recursive  # formatting (from infrastructure/)
npx osls logs -f login                         # tail a Lambda (in services/user-api)
```

## Teardown

Order matters — **destroy the API stack before the KMS units**. CloudFormation
re-resolves the `{{resolve:secretsmanager}}` references on *every* operation,
including delete; with the CMK already pending deletion the stack delete fails
(recovery: `aws kms cancel-key-deletion` + `enable-key` in both regions, retry,
re-schedule).

```sh
# 1. Hosting and edge first (30-edge reads the API stack, so it must go while
#    the stack still exists; 40 depends on 30).
cd infrastructure/dev
(cd 40-frontend-hosting && terragrunt destroy)
(cd 30-edge && terragrunt destroy)

# 2. The API stack (empties its deployment bucket, deletes the secrets).
(cd ../../services/user-api && npx osls remove)

# 3. Everything else.
terragrunt run --all destroy
```

Left behind on purpose, remove manually if wanted:

- `superstruct-user-api-dev-users` DynamoDB table and the audit S3 bucket
  (`DeletionPolicy: Retain`): `aws dynamodb delete-table`, empty + delete the bucket.
- The state bucket (versioned — purge all object versions, then delete).
- KMS keys sit in a mandatory 7-day `PendingDeletion` window.

## Gotchas

- **CLOUDFRONT-scoped WAF web ACLs only exist in us-east-1** — hence
  `30-edge`'s `region.hcl`. Units pin a provider region that way; remote state
  always stays in the home region.
- **Direct execute-api access is enabled** — the raw API URL works, but it
  bypasses CloudFront's WAF, rate limiting, and security headers; treat the
  CloudFront URL as the public entry.
- **New URLs on recreate**: CloudFront domains and Amplify URLs are generated;
  destroying and recreating those units changes both public URLs.
