# Amplify Hosting app for the React SPA. The repo has no git connection —
# builds are pushed with Amplify's manual-deployment API by
# services/frontend/deploy.sh, which reads the SSM parameters published here.

include "root" {
  path = find_in_parent_folders("root.hcl")
}
