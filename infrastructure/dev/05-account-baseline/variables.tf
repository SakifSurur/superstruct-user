variable "aws_region" {
  description = "Region of the account-level service settings."
  type        = string
}

variable "aws_account_id" {
  description = "Account id, used in the SSM service-setting ARN."
  type        = string
}
