output "key_arn" {
  description = "ARN of the application CMK."
  value       = module.kms.key_arn
}

output "secrets_key_alias_parameter" {
  description = "SSM parameter name holding the CMK alias for Secrets Manager encryption."
  value       = aws_ssm_parameter.secrets_key_alias.name
}
