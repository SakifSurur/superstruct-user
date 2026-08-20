# superstruct-user

User HTTP API on AWS — [oss-serverless](https://github.com/oss-serverless/osls) (`osls`),
TypeScript, esbuild, Lambda `nodejs24.x` (arm64) behind API Gateway (HTTP API),
DynamoDB as the database, fronted by CloudFront + WAF.

```
browser ──> Amplify Hosting (Astro SSR, WEB_COMPUTE)
             │  fetch() with CORS locked to the Amplify origin
             ▼
           CloudFront (TLS, security headers, no caching)
             │  WAFv2: AWS managed rules + 300 req/5min/IP rate limit
             │  adds x-origin-verify: <secret>
             ▼
           API Gateway (HTTP API) ──> Lambda (rejects requests without the
             │                        correct x-origin-verify header)
             ▼
           DynamoDB (SSE, PITR, DeletionPolicy: Retain)
```

## Stacks

Only the code that runs (Lambda) is an oss-serverless stack; everything
resources-only is Terraform + Terragrunt:

| Half | What | Where |
| --- | --- | --- |
| `services/user-api` (osls) | Functions, routes, IAM, DynamoDB tables, secrets, audit pipeline | eu-central-1 |
| `services/frontend` | Astro SSR app (React auth island) — published by `41-frontend-deploy` | — |
| `infrastructure/` (Terragrunt) | Everything below | — |

```
infrastructure/
  root.hcl                  # S3 remote state (auto-bootstrapped) + generated provider
  dev/
    env.hcl                 # region, account ID — single source of truth
    00-security-hub/        # self-managed Security Hub CSPM (FSBP + NIST 800-53)
    10-github-oidc-provider/# GitHub Actions OIDC provider
    11-github-actions-role/ # CI deploy role (trust: this repo's main only)
    20-kms/                 # app CMK (multi-Region primary, secrets encryption)
    21-kms-replica/         # us-east-1 replica key
    30-edge/                # CloudFront + WAFv2 in front of the API (us-east-1¹)
    40-frontend-hosting/    # Amplify Hosting app + branch
    41-frontend-deploy/     # Astro build + Amplify manual deployment (publishes
                            # when the frontend source or API URL changes)
```

¹ CloudFront-scoped WAF web ACLs can only live in us-east-1; a unit pins its
provider region with a `region.hcl` next to its `terragrunt.hcl`.

Run with `terragrunt plan` / `terragrunt apply` inside a unit directory, or
`terragrunt run-all apply` from `infrastructure/dev` (`--backend-bootstrap`
on first ever run).

**Cross-tool contract**: within Terragrunt, units wire together with
`dependency` blocks (`41-frontend-deploy` consumes `40-frontend-hosting`'s
app id and `30-edge`'s API URL). Across tools, SSM Parameter Store is the
seam: `40-frontend-hosting` publishes
`/superstruct-user/<stage>/frontend/app-url` (read by the API's CORS config)
and `30-edge` publishes `.../edge/api-url`; `30-edge` itself reads the
user-api stack's `ApiDomain` output and the origin-verify secret's us-east-1
replica.

The frontend is Astro with server-side rendering (Amplify `WEB_COMPUTE`);
the auth panel is a client-only React island since the JWT lives in the
browser. `41-frontend-deploy` publishes it via Amplify's manual-deployment
API: a `terraform_data` resource hashes the source and re-runs the Astro
build + upload only when it (or the API URL) changes.

Bootstrap order, verification, CI setup, day-2 commands, and teardown live in
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## PII safety measures

- **No direct API access** — Lambda rejects requests missing the
  `x-origin-verify` header that only CloudFront attaches (secret generated in
  Secrets Manager, never committed or logged).
- **No edge caching** — CloudFront uses the managed `CachingDisabled` policy so
  user data never sits in a CDN cache.
- **TLS everywhere** — viewers are redirected to HTTPS; CloudFront→origin is
  HTTPS-only (TLS 1.2+); HSTS via the managed `SecurityHeadersPolicy`.
- **WAF** — AWS managed rule sets (IP reputation, common, known bad inputs)
  plus per-IP rate limiting against scraping/enumeration.
- **At rest** — DynamoDB server-side encryption + point-in-time recovery;
  handlers never log request bodies.
- **Detection** — GuardDuty (org-managed; incl. Lambda network logs, S3 data
  events) plus self-managed Security Hub CSPM (FSBP + NIST 800-53 r5) from
  `infrastructure/dev/00-security-hub`.

## Deploy

Steady state (everything already bootstrapped):

```sh
npm install
(cd infrastructure/dev && terragrunt run --all apply)   # all infra units incl. frontend publish
npm run deploy:api                                      # API stack (osls)
```

Fresh account: follow **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. The public
API URL is the CloudFront one from SSM (`/superstruct-user/dev/edge/api-url`)
— the execute-api URL returns 403 by design.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/v1/register` | body: `{ "email", "password", "firstName", "lastName" }` → 201 with auto-generated user ID |
| POST | `/v1/login` | body: `{ "email", "password" }` → `{ token, tokenType, expiresIn, user }` (JWT, HS256, 1h) |
| GET | `/v1/me` | requires `Authorization: Bearer <token>`; returns the profile |
| GET | `/v1/stats` | `{ totalUsers }` — O(1) read of a transactional counter |
| GET | `/v1/me/activity` | JWT-protected; the caller's last 20 audit events, newest first |
| GET | `/v1/security/findings` | JWT-protected; aggregated Security Hub posture (no resource identifiers) |

The API is versioned under `/v1`; a breaking change gets a `/v2` prefix beside
it rather than mutating `/v1`. The frontend renders this table as a collapsible
"API reference" section.

Auth internals: passwords are scrypt-hashed (`node:crypto`, per-user salt,
constant-time compare) and never returned; registration writes the user, an
`email#<email>` uniqueness marker, and the stats counter in one DynamoDB
transaction, so duplicate emails are rejected race-free (409). JWTs are signed
with a key generated in Secrets Manager (`jose`, HS256, issuer-checked).

## Audit trail

Register and login activity is audited end to end:

```
handler ──> EventBridge bus (superstruct-user-audit-<stage>)
              │  rule: source = superstruct-user.api
              ├──> Kinesis Firehose (60s/1MB buffer, GZIP)
              │      └─> s3://superstruct-user-audit-<stage>-<account>/audit/year=/month=/day=/
              └──> auditWriter Lambda ──> DynamoDB audit table (userId + time, 90-day TTL)
                                            └─> GET /v1/me/activity (JWT, own events only)
```

S3 is the immutable archive; DynamoDB is the queryable per-user view shown as
"Recent activity" on the frontend after login. Events without a userId (login
attempts for unknown emails) exist only in the archive.

Events: `user.registered`, `user.login.succeeded`, `user.login.failed`
(with `reason`), each carrying userId/email, client IP, user agent, and a
timestamp — never passwords or hashes (tested). Emission is fail-open: an
EventBridge outage logs an error but never blocks auth. The bucket is
KMS-encrypted, public-access-blocked, retained on stack delete, and expires
objects after 365 days.

## CI/CD

Pushes to `main` deploy automatically via GitHub Actions
(`.github/workflows/deploy.yml`): checks (lint, typecheck, tests) gate a
sequential deploy of the infrastructure and the API. Auth is GitHub OIDC
— the workflow assumes `superstruct-user-github-actions-deploy`
(provisioned in `infrastructure/dev/10-github-oidc-provider` and
`11-github-actions-role`), whose trust policy only accepts
`repo:SakifSurur/superstruct-user:ref:refs/heads/main`. No AWS keys are stored
in GitHub.

## Day-to-day commands

```sh
npm test                          # vitest unit tests (mocked DynamoDB, no AWS calls)
npm run typecheck                 # tsc across all workspaces
npm run lint                      # ESLint (typescript-eslint, type-checked rules)
npm run package:api               # build artifacts without deploying
npx osls info                     # stack info + URLs (run inside a service dir)
npx osls logs -f login            # tail a function (run in services/user-api)
```
