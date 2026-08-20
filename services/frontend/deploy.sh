#!/usr/bin/env bash
# Builds the SPA and publishes it to Amplify Hosting via a manual deployment.
# The Amplify app and the API edge are Terragrunt-managed
# (infrastructure/dev/40-frontend-hosting and 30-edge); this script reads
# their SSM contract parameters.
# Usage: ./deploy.sh [stage]   (default: dev)
set -euo pipefail
cd "$(dirname "$0")"

STAGE="${1:-dev}"
REGION="eu-central-1"

ssm_param() {
  aws ssm get-parameter --name "/superstruct-user/${STAGE}/$1" --region "$REGION" \
    --query 'Parameter.Value' --output text
}

APP_ID=$(ssm_param frontend/app-id)
APP_URL=$(ssm_param frontend/app-url)
API_URL=$(ssm_param edge/api-url)

echo "==> Building SPA against ${API_URL}"
VITE_API_URL="$API_URL" npm run build

echo "==> Uploading build to Amplify app ${APP_ID} (branch main)"
(cd dist && zip -qr ../dist.zip .)
trap 'rm -f dist.zip' EXIT

DEPLOYMENT=$(aws amplify create-deployment --app-id "$APP_ID" --branch-name main --region "$REGION")
JOB_ID=$(echo "$DEPLOYMENT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["jobId"])')
UPLOAD_URL=$(echo "$DEPLOYMENT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["zipUploadUrl"])')

curl -sf -T dist.zip "$UPLOAD_URL"
aws amplify start-deployment --app-id "$APP_ID" --branch-name main --job-id "$JOB_ID" --region "$REGION" >/dev/null

echo "==> Waiting for deployment job ${JOB_ID}"
while true; do
  STATUS=$(aws amplify get-job --app-id "$APP_ID" --branch-name main --job-id "$JOB_ID" --region "$REGION" \
    --query 'job.summary.status' --output text)
  case "$STATUS" in
    SUCCEED) break ;;
    FAILED | CANCELLED) echo "Deployment ${STATUS}" >&2; exit 1 ;;
    *) sleep 5 ;;
  esac
done

echo "==> Deployed: ${APP_URL}"
