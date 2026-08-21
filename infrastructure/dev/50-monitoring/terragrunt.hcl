# CloudWatch monitoring for the user API: alarms (SNS topic) + dashboard.
# Subscribe an email to the topic via alarm_email, or later by hand.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals

  api_stack = "superstruct-user-api-${local.env.environment}"
  functions = ["register", "login", "me", "stats", "securityFindings", "myActivity", "jwks", "auditWriter"]
}

terraform {
  source = "${get_repo_root()}/infrastructure/modules/terraform-aws-api-monitoring"
}

inputs = {
  name           = "${local.env.project}-${local.env.environment}"
  api_stack_name = local.api_stack

  function_names = [for f in local.functions : "${local.api_stack}-${f}"]

  dynamodb_table_names = [
    "${local.api_stack}-users",
    "${local.api_stack}-audit",
  ]
}
