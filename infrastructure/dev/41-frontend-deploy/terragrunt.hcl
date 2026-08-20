# Builds the SPA and publishes it to Amplify Hosting via a manual deployment.
# Runs on `apply` whenever the frontend source (or the API URL baked into the
# build) changes; force a re-publish with:
#   terragrunt apply -replace=terraform_data.publish
#
# Requires node/npm, the AWS CLI, python3, zip, and curl on the machine
# running Terragrunt (true locally and on the CI runner).

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
