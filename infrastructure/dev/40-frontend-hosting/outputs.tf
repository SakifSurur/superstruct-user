output "app_id" {
  description = "Amplify app id, used by the manual-deployment publish script."
  value       = aws_amplify_app.frontend.id
}

output "app_url" {
  description = "Public URL of the frontend; also the allowed CORS origin on the API."
  value       = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.frontend.default_domain}"
}
