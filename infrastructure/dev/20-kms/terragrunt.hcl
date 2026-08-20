# Customer-managed application key (multi-Region primary). Encrypts the app's
# Secrets Manager secrets; the us-east-1 replica (21-kms-replica) covers the
# replicated origin-verify secret used by the CloudFront edge stack.

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

  # Account-root default policy: access is governed by IAM policies.
  enable_default_policy   = true
  deletion_window_in_days = 7

  aliases = ["${local.env.project}/${local.env.environment}"]
}
