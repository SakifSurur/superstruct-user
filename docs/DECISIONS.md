# Design decisions

Short records of choices that shape the architecture, so they aren't
re-litigated later without the original context.

## HTTP API over REST API (2026-08)

**Decision**: the user API stays on API Gateway **HTTP API** (v2), fronted by
CloudFront + WAF with the `x-origin-verify` header closing the direct path.

**Context**: REST APIs support attaching a regional WAF directly to the stage,
which would let us drop CloudFront and the whole origin-verify mechanism —
the one real simplification REST offers this stack.

**Why HTTP API still wins**:

- **Native JWT authorizer** — REST only supports Cognito user-pool or custom
  Lambda authorizers. We are our own issuer (JWKS + OIDC discovery from
  `services/jwks-api`), so on REST we would have to hand-roll a Lambda
  authorizer: verify RS256 ourselves, manage result caching, eat its cold
  starts. The native authorizer validates signature/issuer/audience/expiry
  before our code runs.
- **Built-in CORS** — the `cors:` block (reading the Amplify origin from SSM)
  would become OPTIONS mock integrations and per-method response headers.
- **Cost and latency** — REST is $3.50/M requests vs $1.00/M, with higher
  per-request latency.
- **Migration churn** — REST uses the v1.0 event payload; every handler, the
  test helpers, and the authorizer-claims path would change.
- Dropping CloudFront would also drop the managed security-headers policy,
  edge HTTPS redirect, and the option to cache later — deleting the edge
  security layer, not simplifying it.

**Revisit if**: we need REST-only features (API keys/usage plans, request
validation, resource policies) or move token issuance to Cognito.
