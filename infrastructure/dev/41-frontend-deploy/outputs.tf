output "app_url" {
  description = "Public URL of the deployed frontend."
  value       = var.app_url
}

output "published_source_hash" {
  description = "Hash of the frontend source that produced the live build."
  value       = terraform_data.publish.triggers_replace.source_hash
}
