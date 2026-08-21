# superstruct-user

**TL;DR** — A JWT auth demo, deployed entirely from code: an Astro SSR frontend
(Amplify, git-connected) talking to a serverless HTTP API (Lambda `nodejs24.x` + DynamoDB)
behind CloudFront + WAF. RS256 tokens are verified by API
Gateway's native JWT authorizer against a standalone JWKS service; register
and login activity is audited via EventBridge → S3 + DynamoDB. Only Lambda
code lives in oss-serverless stacks — every resources-only piece (Security
Hub, KMS, JWT keys, CloudFront/WAF, Amplify, CloudWatch monitoring) is
Terragrunt with registry-shaped modules. **Push to `main` and everything
deploys** (GitHub OIDC CI + Amplify auto-build); fresh-account bootstrap is in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

User HTTP API on AWS — [oss-serverless](https://github.com/oss-serverless/osls) (`osls`),
TypeScript, esbuild, Lambda `nodejs24.x` (arm64) behind API Gateway (HTTP API),
DynamoDB as the database, fronted by CloudFront + WAF.

```
browser ──> Amplify Hosting (Astro SSR, WEB_COMPUTE)
             │  fetch() with CORS locked to the Amplify origin
             ▼
           CloudFront (TLS, security headers, no caching)
             │  WAFv2: AWS managed rules + 300 req/5min/IP rate limit
             ▼
           API Gateway (HTTP API) ──> Lambda
             │
             ▼
           DynamoDB (SSE, PITR, DeletionPolicy: Retain)
```

## Stacks

Only the code that runs (Lambda) is an oss-serverless stack; everything
resources-only is Terraform + Terragrunt:

| Half                           | What                                                               | Where        |
| ------------------------------ | ------------------------------------------------------------------ | ------------ |
| `services/user-api` (osls)     | Functions, routes, JWT authorizer, DynamoDB tables, audit pipeline | eu-central-1 |
| `services/jwks-api` (osls)     | Token issuer: JWKS + OIDC discovery for the JWT authorizer         | eu-central-1 |
| `services/frontend`            | Astro SSR app (React auth island) — built by Amplify on push       | —            |
| `infrastructure/` (Terragrunt) | Everything below                                                   | —            |

```
infrastructure/
  root.hcl                  # S3 remote state (auto-bootstrapped) + generated provider
  modules/                  # registry-shaped modules (Blackbird structure)
    terraform-aws-account-baseline/ # account hardening (SG/EBS/SSM public sharing)
    terraform-aws-amplify-hosting/  # git-connected Amplify SSR hosting
    terraform-aws-api-monitoring/   # CloudWatch alarms + dashboard for the API
    terraform-aws-cloudfront-waf/   # CloudFront + WAF edge for an HTTPS origin
    terraform-aws-jwt-signing-key/  # RS256 keypair in Secrets Manager
    terraform-aws-security-hub/     # Security Hub CSPM + control disablements
  environments/
    dev/                    # per-environment tree (staging/prod would sit beside it)
      env.hcl                 # ALL environment config — the single source of truth
      00-security-hub/        # Security Hub CSPM (FSBP + NIST 800-53);
                              # unfixable controls disabled in code, with reasons
      05-account-baseline/    # account hardening: default-SG rules removed, EBS
                              # snapshot + SSM document public sharing blocked
      10-github-oidc-provider/# GitHub Actions OIDC provider
      11-github-actions-role/ # CI deploy role (trust: this repo's main only)
      20-kms/                 # app CMK (secrets encryption)
      22-jwt-signing-key/     # RS256 keypair for JWTs (private key in Secrets Manager)
      25-origin-verify/       # shared secret proving requests came via CloudFront
      30-cloudfront/          # CloudFront + WAFv2 edge (us-east-1¹, uses modules/)
      40-amplify/             # Amplify Hosting app (git-connected, builds on push)
      50-monitoring/          # CloudWatch alarms (SNS) + dashboard
```

¹ CloudFront-scoped WAF web ACLs can only live in us-east-1; a unit pins its
provider region with a `region.hcl` next to its `terragrunt.hcl`.

**Cross-tool contract**: within Terragrunt, units wire together with
`dependency` blocks (`40-amplify` consumes `30-cloudfront`'s API URL).
Across tools, SSM Parameter Store is the seam: `40-amplify` publishes
`/superstruct-user/<stage>/frontend/app-url` (read by the API's CORS config)
and `30-cloudfront` publishes `.../cloudfront/api-url`; `30-cloudfront` itself reads the
user-api stack's `ApiDomain` output.

The frontend is Astro with server-side rendering (Amplify `WEB_COMPUTE`);
the auth panel is a client-only React island since the JWT lives in the
browser. Amplify is git-connected and builds the SSR bundle itself on every
push to `main` — its manual-deployment API does not support SSR compute
bundles.

Bootstrap order, verification, CI setup, day-2 commands, and teardown live in
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## PII safety measures

- **No edge caching** — CloudFront uses the managed `CachingDisabled` policy so
  user data never sits in a CDN cache.
- **TLS everywhere** — viewers are redirected to HTTPS; CloudFront→origin is
  HTTPS-only (TLS 1.2+); HSTS via the managed `SecurityHeadersPolicy`.
- **WAF** — AWS managed rule sets (IP reputation, common, known bad inputs)
  plus per-IP rate limiting against scraping/enumeration.
- **CloudFront-only entry** — the API rejects requests missing the
  `x-origin-verify` header CloudFront injects (secret from
  `25-origin-verify`), so the raw execute-api URL can't bypass the WAF. The
  JWKS API stays directly reachable by design: the API Gateway JWT authorizer
  fetches the issuer's discovery documents directly (it serves only public
  keys).
- **At rest** — DynamoDB server-side encryption + point-in-time recovery;
  handlers never log request bodies.
- **Detection** — GuardDuty (org-managed; incl. Lambda network logs, S3 data
  events) plus self-managed Security Hub CSPM (FSBP + NIST 800-53 r5) from
  `infrastructure/environments/dev/00-security-hub`; controls that cannot be remediated
  from this account are disabled there in code with auditable reasons.
- **Account hardening** — `05-account-baseline` removes the default security
  group's rules and blocks public sharing of EBS snapshots and SSM documents.

## Deploy

Steady state (everything already bootstrapped):

```sh
npm install
(cd infrastructure/environments/dev && terragrunt run --all apply)   # all infra units
npm run deploy:api                                      # API stack (osls)
git push                                                # Amplify builds the frontend
```

Fresh account: follow **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. The
CloudFront URL from SSM (`/superstruct-user/dev/cloudfront/api-url`) is the
recommended entry (WAF, rate limiting, security headers); the raw execute-api
URL also works but bypasses those protections.

## Endpoints

| Method | Path                        | Notes                                                                                      |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/api/v1/register`          | body: `{ "email", "password", "firstName", "lastName" }` → 201 with auto-generated user ID |
| POST   | `/api/v1/login`             | body: `{ "email", "password" }` → `{ token, tokenType, expiresIn, user }` (JWT, RS256, 1h) |
| GET    | `/api/v1/me`                | requires `Authorization: Bearer <token>`; returns the profile                              |
| GET    | `/api/v1/stats`             | `{ totalUsers }` — O(1) read of a transactional counter                                    |
| GET    | `/api/v1/me/activity`       | JWT-protected; the caller's last 20 audit events, newest first                             |
| GET    | `/api/v1/security/findings` | JWT-protected; aggregated Security Hub posture (no resource identifiers)                   |
| GET    | `/.well-known/jwks.json`    | public JWKS (served by the separate `jwks-api`, which is also the token issuer)            |

The API is versioned under `/api/v1`; a breaking change gets an `/api/v2`
prefix beside it rather than mutating `/api/v1`. The frontend serves an
interactive Swagger UI at `/docs` (public).

Auth internals: passwords are scrypt-hashed (`node:crypto`, per-user salt,
constant-time compare) and never returned; registration writes the user, an
`email#<email>` uniqueness marker, and the stats counter in one DynamoDB
transaction, so duplicate emails are rejected race-free (409). JWTs are signed
RS256 (`kid` header) with a keypair from `infrastructure/environments/dev/22-jwt-signing-key`.
Protected routes use API Gateway's **native JWT authorizer**: it validates
signature, issuer, audience, and expiry against the standalone `jwks-api`
(the issuer, serving OIDC discovery + JWKS) before the Lambda runs; handlers
read the validated claims from the request context.

## Observability

Lambdas run with X-Ray active tracing and instrumented AWS SDK clients
(DynamoDB, EventBridge, Security Hub become subsegments) — traces live under
CloudWatch > Traces. HTTP APIs have no gateway-level tracing, so traces begin
at the Lambda. `50-monitoring` provisions the `superstruct-user-<stage>`
dashboard (API traffic/latency, Lambda invocations/errors/duration, DynamoDB
capacity) and 12 alarms (API 5xx, API p99 latency, per-function errors,
per-table throttles) notifying an SNS topic — subscribe with
`aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint you@example.com`.

## Audit trail

Register and login activity is audited end to end:

```
handler ──> EventBridge bus (superstruct-user-audit-<stage>)
              │  rule: source = superstruct-user.api
              ├──> Kinesis Firehose (60s/1MB buffer, GZIP)
              │      └─> s3://superstruct-user-audit-<stage>-<account>/audit/year=/month=/day=/
              └──> auditWriter Lambda ──> DynamoDB audit table (userId + time, 90-day TTL)
                                            └─> GET /api/v1/me/activity (JWT, own events only)
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
(provisioned in `infrastructure/environments/dev/10-github-oidc-provider` and
`11-github-actions-role`), whose trust policy only accepts this repository's
`main` branch via GitHub's immutable-reference subject (account and repo IDs
pinned). No AWS keys are stored in GitHub. The frontend deploys separately:
Amplify builds it on the same push.

## Day-to-day commands

```sh
npm test                          # vitest unit tests (mocked DynamoDB, no AWS calls)
npm run typecheck                 # tsc across all workspaces
npm run lint                      # ESLint (typescript-eslint, type-checked rules)
npm run package:api               # build artifacts without deploying
npx osls info                     # stack info + URLs (run inside a service dir)
npx osls logs -f login            # tail a function (run in services/user-api)
```
