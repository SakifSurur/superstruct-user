# GitHub token for the Amplify<->repo connection. Fine-grained PAT with this
# repo selected and permissions Contents: read + Webhooks: read/write (or a
# classic PAT with repo + admin:repo_hook). Stored out-of-band:
#   aws ssm put-parameter --name /<project>/<env>/github-token --type SecureString --value <PAT>
data "aws_ssm_parameter" "github_token" {
  name = "/${var.project}/${var.environment}/github-token"
}

module "hosting" {
  source = "../../modules/terraform-aws-amplify-hosting"

  name           = "${var.project}-${var.environment}"
  repository_url = var.repository_url
  access_token   = data.aws_ssm_parameter.github_token.value
  framework      = "Astro"

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
                # --prefix . is load-bearing — npm otherwise resolves the
                # workspace root via the nearest lockfile and installs there.
                - cd .amplify-hosting/compute/default && npm init -y > /dev/null && npm install --prefix . --omit=dev "astro@$${ASTRO_V}" "react@$${REACT_V}" "react-dom@$${REACT_V}"
          artifacts:
            baseDirectory: .amplify-hosting
            files:
              - '**/*'
  EOT
}

# Resources predate the module extraction — keep their state addresses.
moved {
  from = aws_iam_role.amplify
  to   = module.hosting.aws_iam_role.this
}

moved {
  from = aws_iam_role_policy_attachment.amplify
  to   = module.hosting.aws_iam_role_policy_attachment.this
}

moved {
  from = aws_amplify_app.frontend
  to   = module.hosting.aws_amplify_app.this
}

moved {
  from = aws_amplify_branch.main
  to   = module.hosting.aws_amplify_branch.this
}

resource "aws_ssm_parameter" "app_id" {
  name  = "/${var.project}/${var.environment}/frontend/app-id"
  type  = "String"
  value = module.hosting.app_id
}

resource "aws_ssm_parameter" "app_url" {
  name  = "/${var.project}/${var.environment}/frontend/app-url"
  type  = "String"
  value = module.hosting.branch_url
}
