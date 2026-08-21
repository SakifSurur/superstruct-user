output "key_arn" {
  description = "ARN of the application CMK."
  value       = module.kms.key_arn
}
