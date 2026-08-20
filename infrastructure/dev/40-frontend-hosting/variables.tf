variable "project" {
  description = "Project slug, used as prefix for resource names and SSM parameters."
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)."
  type        = string
}
