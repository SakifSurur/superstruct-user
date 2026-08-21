data "aws_ssm_parameter" "access_token" {
  count = var.access_token_ssm_parameter != null ? 1 : 0
  name  = var.access_token_ssm_parameter
}

locals {
  access_token = var.access_token_ssm_parameter != null ? data.aws_ssm_parameter.access_token[0].value : var.access_token
}

resource "aws_iam_role" "this" {
  name = "${var.name}-amplify"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "amplify.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "this" {
  role       = aws_iam_role.this.name
  policy_arn = var.service_role_policy_arn
}

resource "aws_amplify_app" "this" {
  name                 = var.name
  platform             = var.platform
  repository           = var.repository_url
  access_token         = local.access_token
  iam_service_role_arn = aws_iam_role.this.arn
  build_spec           = var.build_spec

  environment_variables = var.environment_variables
}

resource "aws_amplify_branch" "this" {
  app_id            = aws_amplify_app.this.id
  branch_name       = var.branch_name
  enable_auto_build = var.enable_auto_build
  framework         = var.framework
  stage             = var.stage
}

resource "aws_ssm_parameter" "app_id" {
  count = var.ssm_contract_prefix != null ? 1 : 0

  name  = "/${var.ssm_contract_prefix}/app-id"
  type  = "String"
  value = aws_amplify_app.this.id
}

resource "aws_ssm_parameter" "app_url" {
  count = var.ssm_contract_prefix != null ? 1 : 0

  name  = "/${var.ssm_contract_prefix}/app-url"
  type  = "String"
  value = "https://${aws_amplify_branch.this.branch_name}.${aws_amplify_app.this.default_domain}"
}
