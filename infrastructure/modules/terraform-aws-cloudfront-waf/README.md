# terraform-aws-cloudfront-waf

CloudFront distribution with a CLOUDFRONT-scoped WAFv2 web ACL (AWS managed
rule sets: IP reputation, Common, Known Bad Inputs, plus per-IP rate limiting)
in front of an HTTPS origin. Caching is disabled (API traffic), all viewer
headers except Host are forwarded, and the managed security-headers policy is
attached.

Requires **two provider configurations**: the default `aws` provider must be
us-east-1 (CLOUDFRONT-scoped WAF), and `aws.home` is the origin's home region,
used for the optional origin CloudFormation-stack lookup and the optional SSM
URL parameter.

## Usage

```hcl
module "edge" {
  source = "tfr://<registry>/terraform-aws-cloudfront-waf?version=X.Y.Z" # or a relative path

  providers = {
    aws      = aws.us_east_1
    aws.home = aws
  }

  name              = "my-app-dev-edge"
  comment           = "my-app dev API edge"
  origin_stack_name = "my-app-api-dev"     # or: origin_domain = "xyz.execute-api…"
  url_ssm_parameter = "/my-app/dev/cloudfront/api-url"
}
```
