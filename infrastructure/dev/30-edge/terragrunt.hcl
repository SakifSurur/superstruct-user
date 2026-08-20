# CloudFront + WAF in front of the user API. Lives in us-east-1 (region.hcl)
# because CLOUDFRONT-scoped WAF web ACLs can only exist there. Reads the API
# domain from the user-api CloudFormation stack and the origin-verify header
# value from the secret's us-east-1 replica, and publishes the public API URL
# to SSM in the home region for the frontend deploy and docs.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

# Second, aliased provider for the environment's home region (data lookups on
# the user-api stack + writing the SSM contract parameter).
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
