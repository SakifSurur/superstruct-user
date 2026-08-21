variable "namespace" {
  description = "Organization or project namespace for the Security Hub component labels."
  type        = string
}

variable "stage" {
  description = "Environment name (dev, staging, production)."
  type        = string
}

variable "name" {
  description = "Component name for the Security Hub labels."
  type        = string
  default     = "security-hub"
}

variable "enabled_standards" {
  description = "Standards to subscribe to, as standards/... or ruleset/... paths (see the aws_securityhub_standards_subscription documentation)."
  type        = list(string)
}

variable "disabled_controls" {
  description = "Controls to disable, keyed by security control id. Each entry maps short standard keys to full standards ARNs and carries the reason recorded in Security Hub."
  type = map(object({
    standards = map(string)
    reason    = string
  }))
  default = {}
}

variable "create_sns_topic" {
  description = "Whether to create an SNS topic and subscription for findings."
  type        = bool
  default     = false
}
