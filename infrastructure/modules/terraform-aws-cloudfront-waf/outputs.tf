output "url" {
  description = "Public HTTPS URL of the CloudFront distribution."
  value       = "https://${aws_cloudfront_distribution.this.domain_name}"
}

output "distribution_id" {
  description = "CloudFront distribution id."
  value       = aws_cloudfront_distribution.this.id
}

output "web_acl_arn" {
  description = "ARN of the WAFv2 web ACL attached to the distribution."
  value       = aws_wafv2_web_acl.this.arn
}
