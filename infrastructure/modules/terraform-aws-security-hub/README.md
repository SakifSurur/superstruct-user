# terraform-aws-security-hub

Self-managed AWS Security Hub CSPM: enables the hub with an explicit set of
standards (via `cloudposse/security-hub/aws`) and disables individual controls
with auditable reasons — for controls that cannot be remediated from the
account (org-managed resources) or are accepted risk.

Note: enabling a standard can exceed the provider's create timeout while its
controls initialize; on timeout, wait for the subscription to become READY and
untaint the resource instead of recreating it.

## Usage

```hcl
module "security_hub" {
  source = "tfr://<registry>/terraform-aws-security-hub?version=X.Y.Z" # or a relative path

  namespace = "my-app"
  stage     = "dev"

  enabled_standards = [
    "standards/aws-foundational-security-best-practices/v/1.0.0",
    "standards/nist-800-53/v/5.0.0",
  ]

  disabled_controls = {
    "Config.1" = {
      standards = {
        fsbp = "arn:aws:securityhub:eu-central-1::standards/aws-foundational-security-best-practices/v/1.0.0"
      }
      reason = "Config recorder is org-managed; not remediable from this account"
    }
  }
}
```
