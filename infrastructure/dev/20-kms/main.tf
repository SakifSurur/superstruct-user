module "kms" {
  source  = "terraform-aws-modules/kms/aws"
  version = "4.2.1"

  description  = "${var.project} ${var.environment} application key (secrets encryption)"
  multi_region = true

  enable_default_policy   = true
  deletion_window_in_days = 7

  aliases = ["${var.project}/${var.environment}"]
}

# user-api reads this with an aws/secretsmanager fallback, so the API stack
# deploys even when this unit was never applied.
resource "aws_ssm_parameter" "secrets_key_alias" {
  name  = "/${var.project}/${var.environment}/kms/secrets-key-alias"
  type  = "String"
  value = "alias/${var.project}/${var.environment}"

  depends_on = [module.kms]
}

moved {
  from = aws_kms_key.this[0]
  to   = module.kms.aws_kms_key.this[0]
}

moved {
  from = aws_kms_alias.this["superstruct-user/dev"]
  to   = module.kms.aws_kms_alias.this["superstruct-user/dev"]
}
