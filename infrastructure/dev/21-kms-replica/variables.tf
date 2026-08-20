variable "project" {
  description = "Project slug, used as prefix for resource names and SSM parameters."
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)."
  type        = string
}

variable "primary_key_arn" {
  description = "ARN of the multi-Region primary key (20-kms) this replica belongs to."
  type        = string
}
