# Builds and publishes the SPA to Amplify when the source or API URL changes.
# Force a re-publish with: terragrunt apply -replace=terraform_data.publish
# Requires node/npm, aws CLI, python3, zip, curl on the machine running this.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

dependency "hosting" {
  config_path = "../40-frontend-hosting"

  mock_outputs = {
    app_id  = "mock-app-id"
    app_url = "https://main.mock.amplifyapp.com"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

dependency "edge" {
  config_path = "../30-edge"

  mock_outputs = {
    api_url = "https://mock.cloudfront.net"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  frontend_dir = "${get_repo_root()}/services/frontend"
  aws_region   = local.env.aws_region
  app_id       = dependency.hosting.outputs.app_id
  app_url      = dependency.hosting.outputs.app_url
  api_url      = dependency.edge.outputs.api_url
}
