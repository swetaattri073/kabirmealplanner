#!/usr/bin/env bash
# Run LittleBowl deploy on a remote EC2/Lightsail host over SSH.
# Works from your Mac, GitHub Actions, or a Cursor Cloud Agent that has the key.
#
# Required env:
#   DEPLOY_HOST          e.g. 15.252.35.8
#   DEPLOY_SSH_KEY       path to private key PEM  OR  DEPLOY_SSH_KEY_B64 (base64 of PEM)
#
# Optional:
#   DEPLOY_USER          default ec2-user
#   GIT_REF              default main
#   DOMAIN               default littlebowl.in
#   ACME_EMAIL           default swetaattri@gmail.com
#   OPENAI_API_KEY / ADMIN_EMAILS / ADMIN_PASSWORD / SECRET_KEY / FEATURE_CHAT_ENABLED
#     — forwarded only when creating a new .env (first boot / --fresh-env)
#   REMOTE_DEPLOY_ARGS   e.g. "--fresh-env"
#
# Usage:
#   DEPLOY_HOST=1.2.3.4 DEPLOY_SSH_KEY=~/.ssh/littlebowl.pem ./remote-deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_USER="${DEPLOY_USER:-ec2-user}"
DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST to the server public IP or DNS}"
GIT_REF="${GIT_REF:-main}"
DOMAIN="${DOMAIN:-littlebowl.in}"
ACME_EMAIL="${ACME_EMAIL:-swetaattri@gmail.com}"
REMOTE_DEPLOY_ARGS="${REMOTE_DEPLOY_ARGS:-}"

KEY_FILE=""
TMP_ENV=""
cleanup() {
  if [[ -n "${KEY_FILE:-}" && -f "${KEY_FILE:-}" && "${KEY_FILE}" == /tmp/littlebowl-deploy-* ]]; then
    rm -f "$KEY_FILE"
  fi
  if [[ -n "${TMP_ENV:-}" && -f "${TMP_ENV:-}" ]]; then
    rm -f "$TMP_ENV"
  fi
}
trap cleanup EXIT

if [[ -n "${DEPLOY_SSH_KEY_B64:-}" ]]; then
  KEY_FILE="$(mktemp /tmp/littlebowl-deploy-XXXXXX.pem)"
  printf '%s' "$DEPLOY_SSH_KEY_B64" | base64 --decode > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
elif [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  KEY_FILE="${DEPLOY_SSH_KEY/#\~/$HOME}"
  if [[ ! -f "$KEY_FILE" ]]; then
    echo "DEPLOY_SSH_KEY not found: $KEY_FILE" >&2
    exit 1
  fi
else
  echo "Set DEPLOY_SSH_KEY (path) or DEPLOY_SSH_KEY_B64 (base64 PEM)" >&2
  exit 1
fi

SSH=(ssh -i "$KEY_FILE" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes
     "${DEPLOY_USER}@${DEPLOY_HOST}")
SCP=(scp -i "$KEY_FILE" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes)

echo "==> Uploading deploy.sh to ${DEPLOY_USER}@${DEPLOY_HOST}"
"${SCP[@]}" "$SCRIPT_DIR/deploy.sh" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/littlebowl-deploy.sh"

TMP_ENV="$(mktemp /tmp/littlebowl-remote-env-XXXXXX)"
{
  printf 'GIT_REF=%q\n' "$GIT_REF"
  printf 'DOMAIN=%q\n' "$DOMAIN"
  printf 'ACME_EMAIL=%q\n' "$ACME_EMAIL"
  for name in SECRET_KEY OPENAI_API_KEY ADMIN_EMAILS ADMIN_PASSWORD FEATURE_CHAT_ENABLED USDA_FDC_API_KEY; do
    if [[ -n "${!name:-}" ]]; then
      printf '%s=%q\n' "$name" "${!name}"
    fi
  done
} > "$TMP_ENV"
chmod 600 "$TMP_ENV"

"${SCP[@]}" "$TMP_ENV" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/littlebowl-remote-env.sh"

echo "==> Running remote deploy (ref=$GIT_REF)"
# shellcheck disable=SC2029
"${SSH[@]}" "chmod +x /tmp/littlebowl-deploy.sh && \
  set -a && . /tmp/littlebowl-remote-env.sh && set +a && \
  rm -f /tmp/littlebowl-remote-env.sh && \
  /tmp/littlebowl-deploy.sh ${REMOTE_DEPLOY_ARGS}"

echo "==> Remote deploy finished"
