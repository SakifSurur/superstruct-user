module "replica" {
  source  = "terraform-aws-modules/kms/aws"
  version = "4.2.1"

  create_replica  = true
  primary_key_arn = var.primary_key_arn
  description     = "${var.project} ${var.environment} application key (us-east-1 replica)"

  enable_default_policy   = true
  deletion_window_in_days = 7

  aliases = ["${var.project}/${var.environment}"]
}

# user-api reads this with an aws/secretsmanager fallback, so the API stack
# deploys even when the KMS units were never applied.
resource "aws_ssm_parameter" "secrets_key_alias" {
  provider = aws.home
  name     = "/${var.project}/${var.environment}/kms/secrets-key-alias"
  type     = "String"
  value    = "alias/${var.project}/${var.environment}"

  depends_on = [module.replica]
}
