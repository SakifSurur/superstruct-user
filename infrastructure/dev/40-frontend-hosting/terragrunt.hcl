# Amplify Hosting (WEB_COMPUTE) building the Astro SSR frontend from GitHub on
# push to main. Requires the github-token SSM parameter (see main.tf).

include "root" {
  path = find_in_parent_folders("root.hcl")
}

dependency "edge" {
  config_path = "../30-edge"

  mock_outputs = {
    api_url = "https://mock.cloudfront.net"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  repository_url = "https://github.com/SakifSurur/superstruct-user"
  api_url        = dependency.edge.outputs.api_url
}
