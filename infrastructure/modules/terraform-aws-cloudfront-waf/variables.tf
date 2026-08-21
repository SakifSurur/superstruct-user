variable "name" {
  description = "Name of the WAF web ACL and metric prefix."
  type        = string
}

variable "origin_domain" {
  description = "Domain name of the HTTPS origin. Mutually exclusive with origin_stack_name."
  type        = string
  default     = null
}

variable "origin_stack_name" {
  description = "CloudFormation stack (in the aws.home region) whose output provides the origin domain. Mutually exclusive with origin_domain."
  type        = string
  default     = null
}

variable "origin_stack_output_key" {
  description = "Output key on origin_stack_name holding the origin domain."
  type        = string
  default     = "ApiDomain"
}

variable "url_ssm_parameter" {
  description = "When set, publishes the distribution URL as this SSM parameter name in the aws.home region."
  type        = string
  default     = null
}

variable "comment" {
  description = "Comment shown on the CloudFront distribution."
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_100"
}

variable "origin_verify_secret_name" {
  description = "Name of a Secrets Manager secret (in the aws.home region) whose value is sent to the origin as the x-origin-verify header, letting the origin reject requests that bypass CloudFront."
  type        = string
  default     = null
}

variable "rate_limit_per_5min" {
  description = "Per-IP request limit per 5 minutes enforced by the WAF rate rule."
  type        = number
  default     = 300
}
