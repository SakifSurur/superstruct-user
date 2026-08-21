# terraform-aws-api-monitoring

CloudWatch monitoring for a serverless HTTP API: an SNS alarm topic, alarms
(API 5xx, API p99 latency, per-function Lambda errors, per-table DynamoDB
throttles), and a dashboard (API traffic/latency, Lambda invocations/errors/
duration, DynamoDB consumed capacity).

The HTTP API id is parsed from a CloudFormation stack output holding the
execute-api domain. Email subscriptions to the alarm topic must be confirmed
from the recipient's inbox.

## Usage

```hcl
module "monitoring" {
  source = "tfr://<registry>/terraform-aws-api-monitoring?version=X.Y.Z" # or a relative path

  name           = "my-app-dev"
  api_stack_name = "my-app-api-dev"

  function_names = [
    "my-app-api-dev-login",
    "my-app-api-dev-register",
  ]

  dynamodb_table_names = ["my-app-api-dev-users"]
  alarm_email          = "oncall@example.com" # optional
}
```
