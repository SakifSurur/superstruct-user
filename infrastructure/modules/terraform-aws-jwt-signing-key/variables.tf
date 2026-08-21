variable "name" {
  description = "Name of the Secrets Manager secret holding the signing key."
  type        = string
}

variable "kms_key_id" {
  description = "KMS key (id, ARN, or alias) encrypting the secret. Defaults to the AWS-managed Secrets Manager key."
  type        = string
  default     = null
}

variable "rsa_bits" {
  description = "RSA key size in bits."
  type        = number
  default     = 2048
}

variable "recovery_window_in_days" {
  description = "Secrets Manager deletion recovery window; 0 allows immediate recreation."
  type        = number
  default     = 7
}
