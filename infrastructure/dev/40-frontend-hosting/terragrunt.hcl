# Amplify Hosting (WEB_COMPUTE) building the Astro SSR frontend from GitHub on
# push to main. Requires the github-token SSM parameter and the Amplify GitHub
# App installed on the repository (see the module README).

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

terraform {
  source = "${get_repo_root()}/infrastructure/modules/terraform-aws-amplify-hosting"
}

dependency "edge" {
  config_path = "../30-edge"

  mock_outputs = {
    url = "https://mock.cloudfront.net"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

inputs = {
  name                       = "${local.env.project}-${local.env.environment}"
  repository_url             = "https://github.com/SakifSurur/superstruct-user"
  access_token_ssm_parameter = "/${local.env.project}/${local.env.environment}/github-token"
  framework                  = "Astro"
  ssm_contract_prefix        = "${local.env.project}/${local.env.environment}/frontend"

  environment_variables = {
    _CUSTOM_IMAGE             = "amplify:al2023"
    AMPLIFY_MONOREPO_APP_ROOT = "services/frontend"
    PUBLIC_API_URL            = dependency.edge.outputs.url
  }

  build_spec = <<-EOT
    version: 1
    applications:
      - appRoot: services/frontend
        frontend:
          phases:
            preBuild:
              commands:
                - npm ci --prefix ../..
            build:
              commands:
                - npm run build
                - ASTRO_V=$(node -p "require('astro/package.json').version")
                - REACT_V=$(node -p "require('react/package.json').version")
                # --prefix . is load-bearing — npm otherwise resolves the
                # workspace root via the nearest lockfile and installs there.
                - cd .amplify-hosting/compute/default && npm init -y > /dev/null && npm install --prefix . --omit=dev "astro@$${ASTRO_V}" "react@$${REACT_V}" "react-dom@$${REACT_V}"
          artifacts:
            baseDirectory: .amplify-hosting
            files:
              - '**/*'
  EOT
}
