# Account-level hardening for Security Hub controls that are one-setting
# fixes: EC2.2 (default SG rules), EC2.182 (EBS snapshot public access),
# SSM.7 (SSM document public sharing).

include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  env = read_terragrunt_config(find_in_parent_folders("env.hcl")).locals
}

inputs = {
  aws_region     = local.env.aws_region
  aws_account_id = local.env.aws_account_id
}
