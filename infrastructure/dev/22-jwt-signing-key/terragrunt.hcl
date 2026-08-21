# RS256 signing key for the API's JWTs. user-api resolves the secret by name
# at deploy time — this unit must exist before the API stack.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

terraform {
  source = "${get_repo_root()}/infrastructure/modules/terraform-aws-jwt-signing-key"
}

dependencies {
  paths = ["../20-kms"]
}

inputs = {
  name       = "${local.env.project}/${local.env.environment}/jwt-signing-key"
  kms_key_id = "alias/${local.env.project}/${local.env.environment}"
}
