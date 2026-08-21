# GitHub Actions OIDC identity provider (one per account).

include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "tfr:///terraform-aws-modules/iam/aws//modules/iam-oidc-provider?version=6.8.0"
}

inputs = {
  url = "https://token.actions.githubusercontent.com"
}
