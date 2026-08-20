output "api_url" {
  description = "Public entry point for the user API (CloudFront)."
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
}

output "distribution_id" {
  description = "CloudFront distribution id."
  value       = aws_cloudfront_distribution.api.id
}

output "web_acl_arn" {
  description = "ARN of the WAFv2 web ACL attached to the distribution."
  value       = aws_wafv2_web_acl.api.arn
}
