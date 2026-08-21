locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals

  project        = local.env.project
  environment    = local.env.environment
  aws_account_id = local.env.aws_account_id

  # A unit pins its provider region with a region.hcl next to its terragrunt.hcl
  # (e.g. 30-cloudfront needs us-east-1); remote state stays in the home region.
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
