variable "name" {
  description = "Prefix for the alarm names, SNS topic, and dashboard."
  type        = string
}

variable "api_stack_name" {
  description = "CloudFormation stack whose output provides the HTTP API domain (the API id is parsed from it)."
  type        = string
}

variable "api_domain_output_key" {
  description = "Output key on api_stack_name holding the execute-api domain."
  type        = string
  default     = "ApiDomain"
}

variable "function_names" {
  description = "Lambda function names to alarm on errors and chart on the dashboard."
  type        = list(string)
}

variable "dynamodb_table_names" {
  description = "DynamoDB table names to alarm on throttling and chart on the dashboard."
  type        = list(string)
  default     = []
}

variable "alarm_email" {
  description = "Email address subscribed to the alarm topic (subscription must be confirmed from the inbox). Null skips the subscription."
  type        = string
  default     = null
}

variable "latency_p99_threshold_ms" {
  description = "API p99 latency threshold in milliseconds before alarming."
  type        = number
  default     = 3000
}
