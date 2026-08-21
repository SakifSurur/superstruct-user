# terraform-aws-account-baseline

Account-level hardening covering the one-setting Security Hub controls:

- **EC2.2** — adopts the default VPC's default security group and removes all
  of its ingress/egress rules.
- **EC2.182** — blocks public sharing of EBS snapshots account-wide.
- **SSM.7** — disables public sharing of SSM documents.

Note: destroying this module does not restore default-SG rules or re-enable
public sharing — the settings simply stop being managed.

## Usage

```hcl
module "account_baseline" {
  source = "tfr://<registry>/terraform-aws-account-baseline?version=X.Y.Z" # or a relative path

  aws_region     = "eu-central-1"
  aws_account_id = "123456789012"
}
```
