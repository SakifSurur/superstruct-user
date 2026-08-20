# Root Terragrunt configuration. Every unit includes this file; per-environment
# settings live in the closest env.hcl.

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals

  project        = local.env.project
  environment    = local.env.environment
  aws_account_id = local.env.aws_account_id

  # A unit may pin its provider to another region (e.g. us-east-1 for KMS
  # replicas) by dropping a region.hcl next to its terragrunt.hcl containing:
  #   locals { aws_region = "us-east-1" }
  # Remote state always stays in the environment's home region.
  aws_region = try(
    read_terragrunt_config("${get_terragrunt_dir()}/region.hcl").locals.aws_region,
    local.env.aws_region,
  )
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
    region       = local.env.aws_region
    encrypt      = true
    use_lockfile = true
  }
}

inputs = {
  project     = local.project
  environment = local.environment
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
