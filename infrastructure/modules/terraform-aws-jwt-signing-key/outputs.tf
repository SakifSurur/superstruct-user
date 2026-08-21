output "secret_name" {
  description = "Name of the Secrets Manager secret (JSON keys: privateKeyPem, kid)."
  value       = aws_secretsmanager_secret.this.name
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret."
  value       = aws_secretsmanager_secret.this.arn
}

output "kid" {
  description = "Key id embedded in JWT headers and the JWKS document."
  value       = local.kid
}

output "public_key_pem" {
  description = "Public key in PEM form; safe to distribute (e.g. to edge validators)."
  value       = tls_private_key.this.public_key_pem
}
