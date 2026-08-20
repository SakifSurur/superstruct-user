variable "frontend_dir" {
  description = "Absolute path to the frontend workspace (vite project) to build and publish."
  type        = string
}

variable "aws_region" {
  description = "Region of the Amplify app."
  type        = string
}

variable "app_id" {
  description = "Amplify app id to publish into."
  type        = string
}

variable "app_url" {
  description = "Public URL of the Amplify branch, re-exported for convenience."
  type        = string
}

variable "api_url" {
  description = "Public API URL baked into the build as VITE_API_URL."
  type        = string
}
