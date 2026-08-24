# Deploying superstruct-user

End-to-end runbook: from an empty AWS account to a fully working stack, plus
day-2 operations and teardown. Architecture background is in the
[README](../README.md).

## What gets deployed

| Piece | Tool | Region |
| --- | --- | --- |
| Terraform state bucket | Terragrunt (auto-bootstrap) | eu-central-1 |
| Security Hub CSPM, account hardening, GitHub OIDC, KMS CMK, JWT signing key, origin-verify secret | Terragrunt (`infrastructure/environments/dev/00–25`) | eu-central-1 |
| JWKS/issuer API (OIDC discovery + JWKS) | oss-serverless (`services/jwks-api`) | eu-central-1 |
| API: Lambda, HTTP API, JWT authorizer, DynamoDB, audit pipeline | oss-serverless (`services/user-api`) | eu-central-1 |
| CloudFront + WAF edge | Terragrunt (`30-cloudfront`) | us-east-1 |
| Amplify hosting (WEB_COMPUTE, git-connected Astro SSR builds) | Terragrunt (`40-amplify`) | eu-central-1 |
| CloudWatch alarms + dashboard | Terragrunt (`50-monitoring`) | eu-central-1 |

## Prerequisites

- **Tools**: node ≥ 22 + npm, Terragrunt ≥ 1.0, OpenTofu (or Terraform ≥ 1.10),
  AWS CLI v2, python3, zip, curl. For CI setup: the `gh` CLI.
- **AWS**: an account with AdministratorAccess credentials, e.g. an SSO
  profile. All commands below assume `AWS_PROFILE` is exported.
- **Config**: `infrastructure/environments/dev/env.hcl` holds ALL environment
  configuration (account, region, repo URL, stack names, SSM contract paths,
  Security Hub standards and control disablements) — units read only it.
- **GitHub token for Amplify**: a fine-grained PAT with this repo selected and
  permissions **Contents: read** + **Webhooks: read/write** (or a classic PAT
  with `repo` + `admin:repo_hook`), stored once as a SecureString (it also
  lands in the hosting unit's Terraform state):
  `aws ssm put-parameter --name /superstruct-user/dev/github-token --type SecureString --value <PAT>`
- **Amplify GitHub App** installed on the repository
  (`https://github.com/apps/aws-amplify-eu-central-1/installations/new`).
  Without it, builds fail with a misleading "Unable to assume specified IAM
  Role" — the PAT alone is not enough; Amplify's build fetches through the App.

```sh
npm install          # workspaces
export AWS_PROFILE=<your-profile>
```

## Fresh-account bootstrap

Ordering matters only on the very first deploy, because two seams cross tool
boundaries: `30-cloudfront` reads the API stack's `ApiDomain` output, and the API's
CORS reads the Amplify URL from SSM.

```sh
cd infrastructure/environments/dev

# 1. State bucket + every unit that does not need the API stack yet.
for unit in 00-security-hub 05-account-baseline 10-github-oidc-provider \
            11-github-actions-role 20-kms 22-jwt-signing-key 25-origin-verify; do
  (cd "$unit" && terragrunt apply --backend-bootstrap)
done

# 2. The issuer, then the API stack (its JWT authorizer resolves the issuer
#    URL from SSM; both need 22-jwt-signing-key, and the API also resolves
#    25-origin-verify). CORS falls back to a localhost origin until the
#    Amplify unit exists.
cd ../.. && npm run deploy:jwks && npm run deploy:api

# 3. Edge, then Amplify hosting (depends on the edge API URL; needs the
#    github-token SSM parameter from the prerequisites).
cd infrastructure/environments/dev && terragrunt run --all apply

# 4. Redeploy the API so CORS picks up the real Amplify origin, then trigger
#    the first frontend build.
cd ../.. && npm run deploy:api
APP_ID=$(aws ssm get-parameter --name /superstruct-user/dev/frontend/app-id \
  --region eu-central-1 --query Parameter.Value --output text)
aws amplify start-job --app-id "$APP_ID" --branch-name main --job-type RELEASE --region eu-central-1
```

Notes:

- `--backend-bootstrap` is only needed once, to create the state bucket. The
  bucket creation asks for confirmation — add `--non-interactive` when running
  unattended (without a TTY the prompt fails with `ERROR EOF`).
- `00-security-hub` may fail with a 3-minute timeout on the FSBP/NIST
  standards-subscription creates while they sit in `PENDING` (observed up to
  ~15 min). Do **not** re-create: wait until
  `aws securityhub get-enabled-standards` shows `READY`, then
  `terragrunt run -- untaint` both
  `module.security_hub.aws_securityhub_standards_subscription.this[...]`
  addresses and re-apply.
- Step 3's CloudFront distribution takes 5–10 minutes to create; the first
  Amplify build takes a few minutes more.
- If you ran `deploy:api` *before* the KMS units ever existed, run it again
  after step 1 so the secrets switch from the AWS-managed key to the CMK.

## Deploying to a different account or a new environment

All Terragrunt configuration derives from one file:
`infrastructure/environments/<env>/env.hcl`. The provider, the
`allowed_account_ids` guard, the state bucket name
(`<project>-terraform-state-<account_id>`), and every unit input read it — so
retargeting is an `env.hcl` edit, not a hunt through units.

- **Different account, same layout**: edit `aws_account_id` (and `aws_region`
  if it moves) in `env.hcl`, export the matching `AWS_PROFILE`, and run the
  fresh-account bootstrap above. The state bucket name changes with the
  account id, so a fresh bucket is bootstrapped automatically.
- **Additional environment** (staging/prod, same or different account): copy
  `environments/dev/` to `environments/<env>/`, then edit only the new
  `env.hcl` (`environment`, `aws_account_id`, `aws_region`). State keys mirror
  the directory path, so the copy starts with clean state — never reuse a
  directory name across accounts without a state migration.

What `env.hcl` does **not** cover — check these when retargeting:

1. **serverless stacks**: both default to `--region eu-central-1 --stage dev`
   (`serverless.yml`); pass `--stage <env> --region <region>` on deploy so
   stack names and the `superstruct-user/<stage>/...` secret/SSM paths line up
   with the new `env.hcl`.
2. **CI** (`.github/workflows/deploy.yml`): `DEPLOY_ROLE_ARN` carries the
   account id and `AWS_REGION` the region; the workflow also hardcodes the
   `environments/dev` working directory.
3. **`11-github-actions-role`**: `oidc_subjects` pins this repo's immutable
   ids — only changes if the repo does.
4. **New-account one-time setup**: the github-token SSM parameter must be
   re-created there, and the Amplify GitHub App is per-region
   (`aws-amplify-<region>`) — a new region means installing that region's app.

## Verify

```sh
API=$(aws ssm get-parameter --name /superstruct-user/dev/cloudfront/api-url \
  --region eu-central-1 --query Parameter.Value --output text)
APP=$(aws ssm get-parameter --name /superstruct-user/dev/frontend/app-url \
  --region eu-central-1 --query Parameter.Value --output text)

curl -s $API/api/v1/stats                          # {"totalUsers":0}
curl -s -o /dev/null -w '%{http_code}\n' $APP  # 200

# Direct execute-api access must be blocked (CloudFront-only entry):
RAW=$(aws cloudformation describe-stacks --stack-name superstruct-user-api-dev \
  --region eu-central-1 --query "Stacks[0].Outputs[?OutputKey=='ApiDomain'].OutputValue" --output text)
curl -s -o /dev/null -w '%{http_code}\n' https://$RAW/api/v1/stats  # 403
```

Register + login through the frontend (`$APP`) or with curl against
`$API/api/v1/register` / `/api/v1/login` — see the API table in the README.

## CI/CD (GitHub Actions)

Pushes to `main` run `.github/workflows/deploy.yml`: checks (lint, typecheck,
tests) gate `terragrunt run --all apply` followed by the JWKS and API deploys.
Auth is
GitHub OIDC — no AWS keys in GitHub.

One-time setup for a new repo or account:

1. Update `oidc_subjects` in `infrastructure/environments/dev/11-github-actions-role/terragrunt.hcl`.
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
terragrunt run --all apply                     # whole infra tree (from infrastructure/environments/dev)
terragrunt hcl format && terraform fmt -recursive  # formatting (from infrastructure/)
npx osls logs -f login                         # tail a Lambda (in services/user-api)
```

## Teardown

Order matters — **destroy the API stack before the KMS units**. CloudFormation
re-resolves the `{{resolve:secretsmanager}}` references on *every* operation,
including delete; with the CMK already pending deletion the stack delete fails
(recovery: `aws kms cancel-key-deletion` + `enable-key`, retry, re-schedule).

```sh
# 1. Units that read the API stack first (they refresh CloudFormation data
#    sources, so the stack must still exist): monitoring, hosting, edge.
cd infrastructure/environments/dev
(cd 50-monitoring && terragrunt destroy)
(cd 40-amplify && terragrunt destroy)
(cd 30-cloudfront && terragrunt destroy)

# 2. Both oss-serverless stacks — before the key units, because CloudFormation
#    re-resolves their secret references even on delete.
(cd ../../../services/user-api && npx osls remove)
(cd ../../../services/jwks-api && npx osls remove)

# 3. Everything else.
terragrunt run --all destroy
```

Left behind on purpose, remove manually if wanted:

- `superstruct-user-api-dev-users` DynamoDB table and the audit S3 bucket
  (`DeletionPolicy: Retain`): `aws dynamodb delete-table`, empty + delete the bucket.
- The state bucket (versioned — purge all object versions, then delete).
- KMS keys sit in a mandatory 7-day `PendingDeletion` window.

## Gotchas

- **The Amplify "Unable to assume specified IAM Role" build error is usually
  not about IAM** — check, in order: the service role exists on the app, the
  Amplify GitHub App is installed on the repo, and the repo connection is
  healthy. All three produce the identical message.
- **npm inside a workspace resolves the project root via the nearest
  lockfile** — any `npm install` meant to land in a sub-directory (like the
  Amplify compute bundle) must pass `--prefix .`.

- **CLOUDFRONT-scoped WAF web ACLs only exist in us-east-1** — hence
  `30-cloudfront`'s `region.hcl`. Units pin a provider region that way; remote state
  always stays in the home region.
- **Direct execute-api access to user-api is blocked** — CloudFront injects
  the `x-origin-verify` header (secret from `25-origin-verify`) and the API
  returns 403 without it, so WAF, rate limiting, and security headers cannot
  be bypassed. The **jwks-api stays directly reachable on purpose**: API
  Gateway's JWT authorizer fetches the issuer's discovery documents directly,
  not through CloudFront. Rotate by tainting the module's `random_password`,
  applying `25-origin-verify`, redeploying user-api, then applying
  `30-cloudfront`.
- **New URLs on recreate**: CloudFront domains and Amplify URLs are generated;
  destroying and recreating those units changes both public URLs.
