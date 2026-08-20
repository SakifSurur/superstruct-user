# GitHub Actions OIDC identity provider (one per account). Lets workflows
# assume IAM roles with short-lived tokens — no long-lived AWS keys in GitHub.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "tfr:///terraform-aws-modules/iam/aws//modules/iam-oidc-provider?version=6.8.0"
}

inputs = {
  url = "https://token.actions.githubusercontent.com"
}
