# Self-managed Security Hub CSPM for this account. The account was deliberately
# disassociated from the org's delegated Security Hub admin (2026-08-19), so
# standards are enabled and owned here instead.
#
# Only FSBP is subscribed — CIS v1.2.0 overlaps heavily with it and mostly adds
# noise. Append to enabled_standards to add more.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

terraform {
  source = "tfr:///cloudposse/security-hub/aws?version=0.13.0"
}

inputs = {
  namespace = local.env.project
  stage     = local.env.environment
  name      = "security-hub"

  # Pick standards explicitly instead of whatever AWS considers default.
  enable_default_standards = false
  enabled_standards = [
    "standards/aws-foundational-security-best-practices/v/1.0.0",
    # NIST 800-53 r5: the standard whose catalog covers privacy/PII protection.
    "standards/nist-800-53/v/5.0.0",
  ]

  # Findings stay in Security Hub; no SNS fan-out for a test account.
  create_sns_topic = false
}
