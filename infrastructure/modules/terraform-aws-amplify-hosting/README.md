# terraform-aws-amplify-hosting

Git-connected AWS Amplify Hosting app for SSR frameworks (platform
`WEB_COMPUTE` per the [Amplify deployment specification](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-deployment-specification.html)),
including the service role Amplify assumes for builds and SSR compute.

Operational notes learned the hard way:

- **GitHub repos require the Amplify GitHub App** installed on the repository
  (`https://github.com/apps/aws-amplify-<region>/installations/new`). Without
  it, builds fail with a misleading "Unable to assume specified IAM Role".
  The access token is only used for repository metadata and webhook setup.
- **Manual deployments do not support SSR compute bundles** — git-based builds
  are the only way to ship `WEB_COMPUTE` apps.
- In monorepos, an `npm install` staging step inside the build must pin its
  location with `--prefix .` — npm otherwise resolves the workspace root via
  the nearest lockfile and installs there.

## Usage

```hcl
module "hosting" {
  source = "tfr://<registry>/terraform-aws-amplify-hosting?version=X.Y.Z" # or a relative path

  name           = "my-app-dev"
  repository_url = "https://github.com/acme/my-app"
  access_token   = data.aws_ssm_parameter.github_token.value
  framework      = "Astro"

  environment_variables = {
    _CUSTOM_IMAGE             = "amplify:al2023"
    AMPLIFY_MONOREPO_APP_ROOT = "services/frontend"
  }

  build_spec = file("${path.module}/buildspec.yml")
}
```
