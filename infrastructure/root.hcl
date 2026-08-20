# Root Terragrunt configuration. Every unit includes this file; per-environment
# settings live in the closest env.hcl.

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals

  project        = local.env.project
  environment    = local.env.environment
  aws_region     = local.env.aws_region
  aws_account_id = local.env.aws_account_id
}

remote_state {
  backend = "s3"

  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }

  # Terragrunt creates the bucket on first run if it does not exist.
  config = {
    bucket       = "${local.project}-terraform-state-${local.aws_account_id}"
    key          = "${path_relative_to_include()}/terraform.tfstate"
    region       = local.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents  = <<EOF
provider "aws" {
  region              = "${local.aws_region}"
  allowed_account_ids = ["${local.aws_account_id}"]

  default_tags {
    tags = {
      Project     = "${local.project}"
      Environment = "${local.environment}"
      ManagedBy   = "terragrunt"
    }
  }
}
EOF
}
