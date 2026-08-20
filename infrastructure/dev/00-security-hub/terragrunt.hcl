# Self-managed Security Hub CSPM — this account is deliberately disassociated
# from the org's delegated admin (2026-08-19).

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

  enable_default_standards = false
  enabled_standards = [
    "standards/aws-foundational-security-best-practices/v/1.0.0",
    "standards/nist-800-53/v/5.0.0", # covers privacy/PII controls
  ]

  create_sns_topic = false
}
