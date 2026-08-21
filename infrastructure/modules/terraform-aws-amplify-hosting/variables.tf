variable "name" {
  description = "Name of the Amplify app; also prefixes the service role name."
  type        = string
}

variable "repository_url" {
  description = "HTTPS URL of the Git repository Amplify builds from. For GitHub, the Amplify GitHub App must be installed on the repository."
  type        = string
}

variable "access_token" {
  description = "Git access token used to read repository metadata and install the build webhook. Builds authenticate via the Amplify GitHub App, not this token. Ignored when access_token_ssm_parameter is set."
  type        = string
  sensitive   = true
  default     = null
}

variable "access_token_ssm_parameter" {
  description = "Name of a SecureString SSM parameter holding the Git access token; takes precedence over access_token."
  type        = string
  default     = null
}

variable "ssm_contract_prefix" {
  description = "When set, publishes the app id and branch URL as /<prefix>/app-id and /<prefix>/app-url SSM parameters for cross-tool consumers."
  type        = string
  default     = null
}

variable "build_spec" {
  description = "Amplify build specification (YAML). For SSR frameworks the artifact baseDirectory must follow the Amplify deployment specification."
  type        = string
}

variable "platform" {
  description = "Amplify hosting platform. Use WEB_COMPUTE for SSR frameworks and WEB for purely static sites."
  type        = string
  default     = "WEB_COMPUTE"
}

variable "environment_variables" {
  description = "Environment variables available to Amplify builds (and SSR compute where applicable)."
  type        = map(string)
  default     = {}
}

variable "branch_name" {
  description = "Git branch Amplify builds and serves."
  type        = string
  default     = "main"
}

variable "enable_auto_build" {
  description = "Whether pushes to the branch trigger Amplify builds automatically."
  type        = bool
  default     = true
}

variable "framework" {
  description = "Framework label shown in the Amplify console (informational)."
  type        = string
  default     = null
}

variable "stage" {
  description = "Amplify stage of the branch (PRODUCTION, BETA, DEVELOPMENT, EXPERIMENTAL, PULL_REQUEST)."
  type        = string
  default     = "PRODUCTION"
}

variable "service_role_policy_arn" {
  description = "IAM policy attached to the Amplify service role that WEB_COMPUTE builds and SSR deployments assume."
  type        = string
  default     = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}
