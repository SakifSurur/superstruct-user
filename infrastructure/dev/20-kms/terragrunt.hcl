# Application CMK (multi-Region primary) for Secrets Manager encryption.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

terraform {
  source = "tfr:///terraform-aws-modules/kms/aws?version=4.2.1"
}

inputs = {
  description  = "${local.env.project} ${local.env.environment} application key (secrets encryption)"
  multi_region = true

  enable_default_policy   = true
  deletion_window_in_days = 7

  aliases = ["${local.env.project}/${local.env.environment}"]
}
