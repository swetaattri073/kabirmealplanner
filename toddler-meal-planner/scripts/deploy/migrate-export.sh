#!/usr/bin/env bash
# Export production meal-data from THIS server into a tarball.
# Use when old and new servers cannot talk to each other:
#   old → Mac (scp) → new
#
# Run ON the old server:
#   ./migrate-export.sh
# Creates: ~/littlebowl-migrate-YYYYMMDD-HHMMSS.tgz
set -euo pipefail

MEAL_DATA_DIR="${MEAL_DATA_DIR:-$HOME/meal-data}"
APP_CONTAINER="${APP_CONTAINER:-meal-planner}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${OUT:-$HOME/littlebowl-migrate-${STAMP}.tgz}"
STAGE="$(mktemp -d /tmp/littlebowl-export-XXXXXX)"

cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

docker_cmd() {
  if docker info >/dev/null 2>&1; then docker "$@"; else sudo docker "$@"; fi
}

if [[ ! -d "$MEAL_DATA_DIR" ]]; then
  echo "Missing data dir: $MEAL_DATA_DIR" >&2
  exit 1
fi

echo "==> Stopping app briefly for a consistent SQLite copy"
docker_cmd stop "$APP_CONTAINER" >/dev/null 2>&1 || true

mkdir -p "$STAGE/meal-data"
# Copy everything under meal-data (db, .env, logs, uploads, caddy config)
cp -a "$MEAL_DATA_DIR"/. "$STAGE/meal-data/"

echo "==> Restarting app on old server"
docker_cmd start "$APP_CONTAINER" >/dev/null 2>&1 || true

tar -czf "$OUT" -C "$STAGE" meal-data
chmod 600 "$OUT"

echo
echo "Export ready: $OUT"
echo "Size: $(du -h "$OUT" | awk '{print $1}')"
echo
echo "On your Mac, download it:"
echo "  scp -i /path/to/old-key.pem ec2-user@OLD_IP:$(basename "$OUT") ."
echo
echo "Then upload to the new server:"
echo "  scp -i /path/to/new-key.pem $(basename "$OUT") ec2-user@NEW_IP:~/"
echo
echo "On the new server, after first deploy (or before traffic):"
echo "  ./migrate-import.sh ~/\$(basename $OUT)"
