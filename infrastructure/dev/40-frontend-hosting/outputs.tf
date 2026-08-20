output "app_id" {
  description = "Amplify app id."
  value       = module.hosting.app_id
}

output "app_url" {
  description = "Public URL of the frontend; also the allowed CORS origin on the API."
  value       = module.hosting.branch_url
}
