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
  access_token         = var.access_token
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
