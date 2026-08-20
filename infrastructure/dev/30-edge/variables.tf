variable "project" {
  description = "Project slug, used as prefix for resource names and SSM parameters."
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)."
  type        = string
}

variable "api_stack_name" {
  description = "Name of the user-api CloudFormation stack whose ApiDomain output becomes the origin."
  type        = string
}
