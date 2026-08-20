# Deploy role assumed by GitHub Actions via OIDC. Trust is scoped to exactly
# this repository's main branch — no other repo, branch, or PR can assume it.
#
# AdministratorAccess because the serverless deploys manage CloudFormation,
# IAM roles, Lambda, API Gateway, DynamoDB, EventBridge, Firehose, S3,
# Secrets Manager, CloudFront, WAF, and Amplify. In a production estate this
# would be a scoped policy per stack.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

dependencies {
  paths = ["../10-github-oidc-provider"]
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

terraform {
  source = "tfr:///terraform-aws-modules/iam/aws//modules/iam-role?version=6.8.0"
}

inputs = {
  name            = "${local.env.project}-github-actions-deploy"
  use_name_prefix = false

  enable_github_oidc = true
  oidc_subjects      = ["SakifSurur/superstruct-user:ref:refs/heads/main"]
  oidc_audiences     = ["sts.amazonaws.com"]

  policies = {
    administrator = "arn:aws:iam::aws:policy/AdministratorAccess"
  }
}
