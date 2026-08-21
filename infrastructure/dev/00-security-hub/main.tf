module "security_hub" {
  source  = "cloudposse/security-hub/aws"
  version = "0.13.0"

  namespace = var.project
  stage     = var.environment
  name      = "security-hub"

  enable_default_standards = false
  enabled_standards = [
    "standards/aws-foundational-security-best-practices/v/1.0.0",
    "standards/nist-800-53/v/5.0.0", # covers privacy/PII controls
  ]

  create_sns_topic = false
}

locals {
  fsbp = "arn:aws:securityhub:${var.aws_region}::standards/aws-foundational-security-best-practices/v/1.0.0"
  nist = "arn:aws:securityhub:${var.aws_region}::standards/nist-800-53/v/5.0.0"

  # Controls deliberately disabled, with the reason attached in Security Hub.
  disabled_controls = {
    "Config.1" = {
      standards = { fsbp = local.fsbp, nist = local.nist }
      reason    = "Config recorder is org-managed via StackSet; not remediable from this account"
    }
    "GuardDuty.6" = {
      standards = { fsbp = local.fsbp }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.7" = {
      standards = { fsbp = local.fsbp }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.8" = {
      standards = { fsbp = local.fsbp }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.11" = {
      standards = { fsbp = local.fsbp }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
  }

  control_associations = merge([
    for control, cfg in local.disabled_controls : {
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

moved {
  from = aws_securityhub_account.this[0]
  to   = module.security_hub.aws_securityhub_account.this[0]
}

moved {
  from = aws_securityhub_standards_subscription.this["arn:aws:securityhub:eu-central-1::standards/aws-foundational-security-best-practices/v/1.0.0"]
  to   = module.security_hub.aws_securityhub_standards_subscription.this["arn:aws:securityhub:eu-central-1::standards/aws-foundational-security-best-practices/v/1.0.0"]
}

moved {
  from = aws_securityhub_standards_subscription.this["arn:aws:securityhub:eu-central-1::standards/nist-800-53/v/5.0.0"]
  to   = module.security_hub.aws_securityhub_standards_subscription.this["arn:aws:securityhub:eu-central-1::standards/nist-800-53/v/5.0.0"]
}
