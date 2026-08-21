terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
      # Default provider must be us-east-1 (CLOUDFRONT-scoped WAF); aws.home
      # is the origin's home region, used for stack lookup and the SSM contract.
      configuration_aliases = [aws.home]
    }
  }
}
