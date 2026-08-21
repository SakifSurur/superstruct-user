variable "project" {
  description = "Project slug, used as the Security Hub component namespace."
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)."
  type        = string
}

variable "aws_region" {
  description = "Region of the Security Hub standards subscriptions."
  type        = string
}
