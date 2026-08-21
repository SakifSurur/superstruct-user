output "enabled_subscriptions" {
  description = "ARNs of the standards subscriptions that were enabled."
  value       = module.security_hub.enabled_subscriptions
}

output "disabled_control_associations" {
  description = "Control/standard pairs that were disabled, with their reasons."
  value       = { for k, v in aws_securityhub_standards_control_association.disabled : k => v.updated_reason }
}
