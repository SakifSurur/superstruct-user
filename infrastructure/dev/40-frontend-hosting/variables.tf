variable "project" {
  description = "Project slug, used as prefix for resource names and SSM parameters."
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)."
  type        = string
}

variable "repository_url" {
  description = "HTTPS URL of the GitHub repository Amplify builds from."
  type        = string
}

variable "api_url" {
  description = "Public API URL baked into the Astro build as PUBLIC_API_URL."
  type        = string
}
