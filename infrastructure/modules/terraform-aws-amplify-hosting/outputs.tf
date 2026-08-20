output "app_id" {
  description = "ID of the Amplify app."
  value       = aws_amplify_app.this.id
}

output "app_arn" {
  description = "ARN of the Amplify app."
  value       = aws_amplify_app.this.arn
}

output "default_domain" {
  description = "Default amplifyapp.com domain of the app."
  value       = aws_amplify_app.this.default_domain
}

output "branch_url" {
  description = "Public HTTPS URL of the deployed branch."
  value       = "https://${aws_amplify_branch.this.branch_name}.${aws_amplify_app.this.default_domain}"
}

output "service_role_arn" {
  description = "ARN of the IAM service role the app uses for builds and SSR compute deployment."
  value       = aws_iam_role.this.arn
}
