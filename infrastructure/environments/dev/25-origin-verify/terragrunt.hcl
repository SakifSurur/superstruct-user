# Shared origin-verify secret: 30-cloudfront injects it as a custom origin
# header and user-api rejects requests without it, closing the direct
# execute-api path. user-api resolves the secret by name at deploy time —
# this unit must exist before the API stack.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

terraform {
  source = "tfr:///terraform-aws-modules/secrets-manager/aws?version=2.1.0"
}

dependencies {
  paths = ["../20-kms"]
}

inputs = {
  name                    = local.env.origin_verify_secret_name
  description             = "Header value proving a request passed through CloudFront"
  kms_key_id              = local.env.kms_alias
  recovery_window_in_days = 0

  create_random_password           = true
  random_password_length           = 48
  random_password_override_special = "-._~" # keep the value header-safe
}
