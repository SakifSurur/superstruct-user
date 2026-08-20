# us-east-1 replica of the application key (20-kms). Same alias, so the edge
# stack's replicated secret encrypts under the CMK in its own region.

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

dependency "primary" {
  config_path = "../20-kms"

  mock_outputs = {
    key_arn = "arn:aws:kms:eu-central-1:000000000000:key/mrk-00000000000000000000000000000000"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

terraform {
  source = "tfr:///terraform-aws-modules/kms/aws?version=4.2.1"
}

inputs = {
  create_replica  = true
  primary_key_arn = dependency.primary.outputs.key_arn
  description     = "${local.env.project} ${local.env.environment} application key (us-east-1 replica)"

  enable_default_policy   = true
  deletion_window_in_days = 7

  aliases = ["${local.env.project}/${local.env.environment}"]
}
