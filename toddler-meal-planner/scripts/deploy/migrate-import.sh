#!/usr/bin/env bash
# Import a meal-data tarball produced by migrate-export.sh onto THIS server.
# Replaces /home/ec2-user/meal-data (DB + .env + uploads), then restarts the app.
#
# Run ON the new server:
#   ./migrate-import.sh ~/littlebowl-migrate-....tgz
set -euo pipefail

ARCHIVE="${1:?Usage: $0 /path/to/littlebowl-migrate-....tgz}"
MEAL_DATA_DIR="${MEAL_DATA_DIR:-$HOME/meal-data}"
APP_CONTAINER="${APP_CONTAINER:-meal-planner}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/meal-data-pre-import-$(date +%Y%m%d-%H%M%S)}"

docker_cmd() {
  if docker info >/dev/null 2>&1; then docker "$@"; else sudo docker "$@"; fi
}

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi

STAGE="$(mktemp -d /tmp/littlebowl-import-XXXXXX)"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

echo "==> Extracting $ARCHIVE"
tar -tzf "$ARCHIVE" | head
tar -xzf "$ARCHIVE" -C "$STAGE"

if [[ ! -d "$STAGE/meal-data" ]]; then
  echo "Archive missing top-level meal-data/ directory" >&2
  exit 1
fi

if [[ ! -f "$STAGE/meal-data/toddler_meals.db" && ! -f "$STAGE/meal-data/.env" ]]; then
  echo "Archive does not look like a LittleBowl meal-data backup" >&2
  exit 1
fi

echo "==> Stopping app"
docker_cmd stop "$APP_CONTAINER" >/dev/null 2>&1 || true

if [[ -d "$MEAL_DATA_DIR" ]]; then
  echo "==> Backing up current $MEAL_DATA_DIR → $BACKUP_DIR"
  mv "$MEAL_DATA_DIR" "$BACKUP_DIR"
fi

echo "==> Installing imported meal-data"
mkdir -p "$(dirname "$MEAL_DATA_DIR")"
cp -a "$STAGE/meal-data" "$MEAL_DATA_DIR"
chmod 600 "$MEAL_DATA_DIR/.env" 2>/dev/null || true

if docker_cmd inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  echo "==> Starting app"
  docker_cmd start "$APP_CONTAINER"
  sleep 3
  echo "==> Verifying"
  docker_cmd exec "$APP_CONTAINER" python3 - <<'PY'
from sqlalchemy import inspect
from app import app
from models import Food, User, db
with app.app_context():
    print("food_count", Food.query.count())
    print("user_count", User.query.count())
    print("tables", len(inspect(db.engine).get_table_names()))
PY
else
  echo "==> App container not running yet."
  echo "    meal-data is in place. Run deploy.sh / remote-deploy.sh next;"
  echo "    it will reuse this imported DB and .env."
fi

echo
echo "Import complete."
echo "Previous data (if any): $BACKUP_DIR"
echo "Active data: $MEAL_DATA_DIR"
