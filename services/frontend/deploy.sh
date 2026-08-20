#!/usr/bin/env bash
# Deploys the frontend: hosting stack -> SPA build -> Amplify manual deployment.
# Usage: ./deploy.sh [stage]   (default: dev)
set -euo pipefail
cd "$(dirname "$0")"

STAGE="${1:-dev}"
REGION="eu-central-1"
EDGE_REGION="us-east-1"

echo "==> Deploying hosting stack (superstruct-user-frontend-${STAGE})"
npx osls deploy --stage "$STAGE"

stack_output() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$2" \
    --query "Stacks[0].Outputs[?OutputKey=='$3'].OutputValue" --output text
}

APP_ID=$(stack_output "superstruct-user-frontend-${STAGE}" "$REGION" AppId)
APP_URL=$(stack_output "superstruct-user-frontend-${STAGE}" "$REGION" AppUrl)
API_URL=$(stack_output "superstruct-user-edge-${STAGE}" "$EDGE_REGION" ApiUrl)

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
