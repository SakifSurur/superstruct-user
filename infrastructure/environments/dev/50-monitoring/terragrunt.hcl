# CloudWatch monitoring for the user API: alarms (SNS topic) + dashboard.
# Subscribe an email to the topic via alarm_email, or later by hand.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

terraform {
  source = "${get_repo_root()}/infrastructure/modules/terraform-aws-api-monitoring"
}

inputs = {
  name           = "${local.env.project}-${local.env.environment}"
  api_stack_name = local.env.api_stack_name

  function_names = concat(
    [for f in local.env.api_function_names : "${local.env.api_stack_name}-${f}"],
    [for f in local.env.jwks_function_names : "${local.env.jwks_stack_name}-${f}"],
  )

  dynamodb_table_names = [
    "${local.env.api_stack_name}-users",
    "${local.env.api_stack_name}-audit",
  ]
}
