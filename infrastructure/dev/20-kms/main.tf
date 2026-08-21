module "kms" {
  source  = "terraform-aws-modules/kms/aws"
  version = "4.2.1"

  description  = "${var.project} ${var.environment} application key (secrets encryption)"
  multi_region = true

  enable_default_policy   = true
  deletion_window_in_days = 7

  aliases = ["${var.project}/${var.environment}"]
}

moved {
  from = aws_kms_key.this[0]
  to   = module.kms.aws_kms_key.this[0]
}

moved {
  from = aws_kms_alias.this["superstruct-user/dev"]
  to   = module.kms.aws_kms_alias.this["superstruct-user/dev"]
}
