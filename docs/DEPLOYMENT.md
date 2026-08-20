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
| Amplify hosting (WEB_COMPUTE) + Astro SSR publish | Terragrunt (`40-frontend-hosting`, `41-frontend-deploy`) | eu-central-1 |

## Prerequisites

- **Tools**: node ≥ 22 + npm, Terragrunt ≥ 1.0, OpenTofu (or Terraform ≥ 1.10),
  AWS CLI v2, python3, zip, curl. For CI setup: the `gh` CLI.
- **AWS**: an account with AdministratorAccess credentials, e.g. an SSO
  profile. All commands below assume `AWS_PROFILE` is exported.
- **Config**: set the account ID and region in `infrastructure/dev/env.hcl` —
  the single source of truth every unit reads.

```sh
npm install          # workspaces; also the SPA build deps used by 41-frontend-deploy
export AWS_PROFILE=<your-profile>
```

## Fresh-account bootstrap

Ordering matters only on the very first deploy, because two seams cross tool
boundaries: `30-edge` reads the API stack's `ApiDomain` output, and the API's
CORS reads the Amplify URL from SSM.

```sh
cd infrastructure/dev

# 1. State bucket + every unit that does not need the API stack yet
#    (30-edge and 41-frontend-deploy come later).
for unit in 00-security-hub 10-github-oidc-provider 11-github-actions-role \
            20-kms 21-kms-replica 40-frontend-hosting; do
  (cd "$unit" && terragrunt apply --backend-bootstrap)
done

# 2. The API stack. It would deploy standalone too (CORS falls back to a
#    localhost origin, secrets encryption to the AWS-managed key) — after
#    step 1 it picks up the real Amplify origin and the CMK from SSM.
cd ../.. && npm run deploy:api

# 3. Edge + frontend publish (all other units no-op).
cd infrastructure/dev && terragrunt run --all apply
```

Notes:

- `--backend-bootstrap` is only needed once, to create the state bucket.
- Step 3's CloudFront distribution takes 5–10 minutes to create.
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

The frontend republish (`41-frontend-deploy`) is hash-driven: CI runs it on
every push but it only rebuilds/uploads when `services/frontend` source or the
API URL changed. The bundle follows Amplify's deploy spec (`deploy-manifest.json`
+ `static/` + `compute/default/`, with a production node_modules staged in).

## Day-2 operations

```sh
npm test / npm run lint / npm run typecheck    # local checks (CI runs the same)
npm run deploy:api                             # API only
terragrunt apply                               # single unit, run inside its directory
terragrunt run --all apply                     # whole infra tree (from infrastructure/dev)
terragrunt apply -replace=terraform_data.publish   # force frontend republish (in 41-frontend-deploy)
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
# 1. Edge + frontend publish state first (30-edge reads the API stack, so it must
#    go while the stack still exists).
cd infrastructure/dev
(cd 41-frontend-deploy && terragrunt destroy)
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
