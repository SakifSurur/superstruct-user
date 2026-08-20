locals {
  # A change in anything that influences the artifact re-runs the build + upload.
  source_hash = sha1(join("", concat(
    [for f in sort(fileset("${var.frontend_dir}/src", "**")) : filesha1("${var.frontend_dir}/src/${f}")],
    [
      filesha1("${var.frontend_dir}/index.html"),
      filesha1("${var.frontend_dir}/package.json"),
      filesha1("${var.frontend_dir}/vite.config.ts"),
      filesha1("${var.frontend_dir}/tsconfig.json"),
    ],
  )))
}

resource "terraform_data" "publish" {
  triggers_replace = {
    source_hash = local.source_hash
    api_url     = var.api_url
    app_id      = var.app_id
  }

  provisioner "local-exec" {
    working_dir = var.frontend_dir
    interpreter = ["bash", "-c"]

    environment = {
      VITE_API_URL = var.api_url
      APP_ID       = var.app_id
      REGION       = var.aws_region
    }

    command = <<-EOT
      set -euo pipefail

      echo "==> Building SPA against $${VITE_API_URL}"
      npm run build

      echo "==> Uploading build to Amplify app $${APP_ID} (branch main)"
      (cd dist && zip -qr ../dist.zip .)
      trap 'rm -f dist.zip' EXIT

      DEPLOYMENT=$(aws amplify create-deployment --app-id "$${APP_ID}" --branch-name main --region "$${REGION}")
      JOB_ID=$(echo "$${DEPLOYMENT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["jobId"])')
      UPLOAD_URL=$(echo "$${DEPLOYMENT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["zipUploadUrl"])')

      curl -sf -T dist.zip "$${UPLOAD_URL}"
      aws amplify start-deployment --app-id "$${APP_ID}" --branch-name main --job-id "$${JOB_ID}" --region "$${REGION}" >/dev/null

      echo "==> Waiting for deployment job $${JOB_ID}"
      while true; do
        STATUS=$(aws amplify get-job --app-id "$${APP_ID}" --branch-name main --job-id "$${JOB_ID}" --region "$${REGION}" \
          --query 'job.summary.status' --output text)
        case "$${STATUS}" in
          SUCCEED) break ;;
          FAILED | CANCELLED) echo "Deployment $${STATUS}" >&2; exit 1 ;;
          *) sleep 5 ;;
        esac
      done

      echo "==> Deployed"
    EOT
  }
}
