# us-east-1 replica of the application key (20-kms), same alias. Publishes the
# alias to SSM last, so the parameter's existence implies both keys exist.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

# Aliased home-region provider for the SSM contract parameter.
generate "provider_home" {
  path      = "provider_home.tf"
  if_exists = "overwrite"
  contents  = <<EOF
provider "aws" {
  alias               = "home"
  region              = "${local.env.aws_region}"
  allowed_account_ids = ["${local.env.aws_account_id}"]

  default_tags {
    tags = {
      Project     = "${local.env.project}"
      Environment = "${local.env.environment}"
      ManagedBy   = "terragrunt"
    }
  }
}
EOF
}

dependency "primary" {
  config_path = "../20-kms"

  mock_outputs = {
    key_arn = "arn:aws:kms:eu-central-1:000000000000:key/mrk-00000000000000000000000000000000"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  primary_key_arn = dependency.primary.outputs.key_arn
}
