# CloudFront + WAF in front of the user API (us-east-1 — CLOUDFRONT-scoped
# WAF web ACLs can only exist there).

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

# Aliased home-region provider for the user-api stack lookup and the SSM parameter.
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

inputs = {
  api_stack_name = "superstruct-user-api-${local.env.environment}"
}
