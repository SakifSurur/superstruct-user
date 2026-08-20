# GitHub token for the Amplify<->repo connection (classic PAT, scopes:
# repo + admin:repo_hook). Stored out-of-band:
#   aws ssm put-parameter --name /<project>/<env>/github-token --type SecureString --value <PAT>
data "aws_ssm_parameter" "github_token" {
  name = "/${var.project}/${var.environment}/github-token"
}

# WEB_COMPUTE + git-based builds: Amplify builds the Astro SSR bundle itself on
# push to main (manual deployments do not support SSR compute bundles).
resource "aws_amplify_app" "frontend" {
  name         = "${var.project}-${var.environment}"
  platform     = "WEB_COMPUTE"
  repository   = var.repository_url
  access_token = data.aws_ssm_parameter.github_token.value

  environment_variables = {
    _CUSTOM_IMAGE             = "amplify:al2023"
    AMPLIFY_MONOREPO_APP_ROOT = "services/frontend"
    PUBLIC_API_URL            = var.api_url
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
                # npm init first — without a package.json here, npm would walk
                # up and install into the workspace root instead.
                - cd .amplify-hosting/compute/default && npm init -y > /dev/null && npm install --omit=dev "astro@$${ASTRO_V}" "react@$${REACT_V}" "react-dom@$${REACT_V}"
          artifacts:
            baseDirectory: .amplify-hosting
            files:
              - '**/*'
  EOT
}

resource "aws_amplify_branch" "main" {
  app_id            = aws_amplify_app.frontend.id
  branch_name       = "main"
  enable_auto_build = true
  framework         = "Astro"
  stage             = "PRODUCTION"
}

resource "aws_ssm_parameter" "app_id" {
  name  = "/${var.project}/${var.environment}/frontend/app-id"
  type  = "String"
  value = aws_amplify_app.frontend.id
}

resource "aws_ssm_parameter" "app_url" {
  name  = "/${var.project}/${var.environment}/frontend/app-url"
  type  = "String"
  value = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.frontend.default_domain}"
}
