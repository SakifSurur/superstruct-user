data "aws_vpc" "default" {
  default = true
}

# EC2.2 — adopting the default VPC's default security group with no ingress or
# egress blocks removes all of its rules.
resource "aws_default_security_group" "default_vpc" {
  vpc_id = data.aws_vpc.default.id
}

# EC2.182 — no EBS snapshot in this account may ever be shared publicly.
resource "aws_ebs_snapshot_block_public_access" "this" {
  state = "block-all-sharing"
}

# SSM.7 — SSM documents cannot be shared publicly.
resource "aws_ssm_service_setting" "document_public_sharing" {
  setting_id    = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:servicesetting/ssm/documents/console/public-sharing-permission"
  setting_value = "Disable"
}
