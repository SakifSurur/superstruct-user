module "security_hub" {
  source  = "cloudposse/security-hub/aws"
  version = "0.13.0"

  namespace = var.namespace
  stage     = var.stage
  name      = var.name

  enable_default_standards = false
  enabled_standards        = var.enabled_standards

  create_sns_topic = var.create_sns_topic
}

locals {
  control_associations = merge([
    for control, cfg in var.disabled_controls : {
      for std_key, std_arn in cfg.standards : "${control}/${std_key}" => {
        control  = control
        standard = std_arn
        reason   = cfg.reason
      }
    }
  ]...)
}

resource "aws_securityhub_standards_control_association" "disabled" {
  for_each = local.control_associations

  standards_arn       = each.value.standard
  security_control_id = each.value.control
  association_status  = "DISABLED"
  updated_reason      = each.value.reason

  depends_on = [module.security_hub]
}
