# Application CMK for Secrets Manager encryption; publishes the alias to SSM
# so user-api can fall back to the AWS-managed key when this unit is absent.

include "root" {
  path = find_in_parent_folders("root.hcl")
}
