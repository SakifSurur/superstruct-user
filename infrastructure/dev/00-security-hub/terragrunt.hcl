# Self-managed Security Hub CSPM — this account is deliberately disassociated
# from the org's delegated admin (2026-08-19). Controls that cannot be fixed
# from this account are disabled with reasons (recorded in Security Hub).

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals

  fsbp = "arn:aws:securityhub:${local.env.aws_region}::standards/aws-foundational-security-best-practices/v/1.0.0"
  nist = "arn:aws:securityhub:${local.env.aws_region}::standards/nist-800-53/v/5.0.0"
}

terraform {
  source = "${get_repo_root()}/infrastructure/modules/terraform-aws-security-hub"
}

inputs = {
  namespace = local.env.project
  stage     = local.env.environment

  enabled_standards = [
    "standards/aws-foundational-security-best-practices/v/1.0.0",
    "standards/nist-800-53/v/5.0.0", # covers privacy/PII controls
  ]

  disabled_controls = {
    "Config.1" = {
      standards = { fsbp = local.fsbp, nist = local.nist }
      reason    = "Config recorder is org-managed via StackSet; not remediable from this account"
    }
    "GuardDuty.6" = {
      standards = { fsbp = local.fsbp }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.7" = {
      standards = { fsbp = local.fsbp }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.8" = {
      standards = { fsbp = local.fsbp }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.11" = {
      standards = { fsbp = local.fsbp }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
  }
}
