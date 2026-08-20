resource "aws_amplify_app" "frontend" {
  name     = "${var.project}-${var.environment}"
  platform = "WEB"

  # SPA fallback: non-asset paths serve index.html.
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|js|map|json|png|svg|jpg|ico|txt|woff2?)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }
}

resource "aws_amplify_branch" "main" {
  app_id            = aws_amplify_app.frontend.id
  branch_name       = "main"
  enable_auto_build = false
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
