# Self-managed Security Hub CSPM — this account is deliberately disassociated
# from the org's delegated admin (2026-08-19). Controls that cannot be fixed
# from this account (or are accepted risk) are disabled in code with reasons.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

inputs = {
  aws_region = local.env.aws_region
}
