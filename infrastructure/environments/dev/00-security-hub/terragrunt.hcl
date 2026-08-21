# Self-managed Security Hub CSPM — this account is deliberately disassociated
# from the org's delegated admin (2026-08-19). Standards and control
# disablements are configured in env.hcl.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

terraform {
  source = "${get_repo_root()}/infrastructure/modules/terraform-aws-security-hub"
}

inputs = {
  namespace = local.env.project
  stage     = local.env.environment

  enabled_standards = local.env.security_hub_enabled_standards
  disabled_controls = local.env.security_hub_disabled_controls
}
