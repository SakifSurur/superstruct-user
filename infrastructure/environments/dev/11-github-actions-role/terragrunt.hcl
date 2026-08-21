# CI deploy role, assumable only by this repository's main branch via OIDC.
# AdministratorAccess is a test-account trade-off; production would scope it.

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
  # GitHub's immutable-reference sub format: account/repo IDs pinned, rename-proof.
  oidc_subjects  = ["SakifSurur@83817182/superstruct-user@1340972459:ref:refs/heads/main"]
  oidc_audiences = ["sts.amazonaws.com"]

  policies = {
    administrator = "arn:aws:iam::aws:policy/AdministratorAccess"
  }
}
