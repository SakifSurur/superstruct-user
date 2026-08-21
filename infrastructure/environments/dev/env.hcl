locals {
  project        = "superstruct-user"
  environment    = "dev"
  aws_region     = "eu-central-1"
  aws_account_id = "076899628449"

  # oss-serverless stacks the infrastructure integrates with.
  api_stack_name  = "${local.project}-api-${local.environment}"
  jwks_stack_name = "${local.project}-jwks-${local.environment}"

  # GitHub / Amplify.
  github_repository_url      = "https://github.com/SakifSurur/superstruct-user"
  github_token_ssm_parameter = "/${local.project}/${local.environment}/github-token"

  # Cross-tool SSM contract.
  api_url_ssm_parameter = "/${local.project}/${local.environment}/cloudfront/api-url"
  frontend_ssm_prefix   = "${local.project}/${local.environment}/frontend"

  # Secrets / KMS.
  kms_alias                   = "alias/${local.project}/${local.environment}"
  jwt_signing_key_secret_name = "${local.project}/${local.environment}/jwt-signing-key"

  # Lambda functions covered by monitoring (per stack).
  api_function_names  = ["register", "login", "me", "stats", "securityFindings", "myActivity", "metrics", "auditWriter"]
  jwks_function_names = ["jwks", "openidConfiguration"]

  # Security Hub configuration.
  fsbp_standard_arn = "arn:aws:securityhub:${local.aws_region}::standards/aws-foundational-security-best-practices/v/1.0.0"
  nist_standard_arn = "arn:aws:securityhub:${local.aws_region}::standards/nist-800-53/v/5.0.0"

  security_hub_enabled_standards = [
    "standards/aws-foundational-security-best-practices/v/1.0.0",
    "standards/nist-800-53/v/5.0.0", # covers privacy/PII controls
  ]

  # Controls that cannot be fixed from this account, disabled with reasons.
  security_hub_disabled_controls = {
    "Config.1" = {
      standards = { fsbp = local.fsbp_standard_arn, nist = local.nist_standard_arn }
      reason    = "Config recorder is org-managed via StackSet; not remediable from this account"
    }
    "GuardDuty.6" = {
      standards = { fsbp = local.fsbp_standard_arn }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.7" = {
      standards = { fsbp = local.fsbp_standard_arn }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.8" = {
      standards = { fsbp = local.fsbp_standard_arn }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
    "GuardDuty.11" = {
      standards = { fsbp = local.fsbp_standard_arn }
      reason    = "GuardDuty detector is administered by the org delegated admin"
    }
  }
}
