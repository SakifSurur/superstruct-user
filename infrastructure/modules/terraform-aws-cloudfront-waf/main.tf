data "aws_cloudformation_stack" "origin" {
  count = var.origin_stack_name != null ? 1 : 0

  provider = aws.home
  name     = var.origin_stack_name
}

data "aws_secretsmanager_secret_version" "origin_verify" {
  count = var.origin_verify_secret_name != null ? 1 : 0

  provider  = aws.home
  secret_id = var.origin_verify_secret_name
}

locals {
  origin_domain = var.origin_stack_name != null ? data.aws_cloudformation_stack.origin[0].outputs[var.origin_stack_output_key] : var.origin_domain
}

resource "aws_wafv2_web_acl" "this" {
  name  = var.name
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = var.name
    sampled_requests_enabled   = true
  }

  rule {
    name     = "aws-ip-reputation"
    priority = 0

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAmazonIpReputationList"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-common"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-known-bad-inputs"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit-per-ip"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        limit              = var.rate_limit_per_5min
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-per-ip"
      sampled_requests_enabled   = true
    }
  }
}

resource "aws_cloudfront_distribution" "this" {
  enabled      = true
  comment      = var.comment
  http_version = "http2and3"
  price_class  = var.price_class
  web_acl_id   = aws_wafv2_web_acl.this.arn

  origin {
    origin_id   = "origin"
    domain_name = local.origin_domain

    dynamic "custom_header" {
      for_each = var.origin_verify_secret_name != null ? [1] : []

      content {
        name  = "x-origin-verify"
        value = data.aws_secretsmanager_secret_version.origin_verify[0].secret_string
      }
    }

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03" # SecurityHeadersPolicy
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_ssm_parameter" "url" {
  count = var.url_ssm_parameter != null ? 1 : 0

  provider = aws.home
  name     = var.url_ssm_parameter
  type     = "String"
  value    = "https://${aws_cloudfront_distribution.this.domain_name}"
}
