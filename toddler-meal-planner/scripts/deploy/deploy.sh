#!/usr/bin/env bash
# Idempotent LittleBowl server deploy.
# - First run: installs Docker if needed, clones/pulls repo, creates meal-data,
#   builds image, starts meal-planner + Caddy.
# - Later runs: git pull + rebuild meal-planner only (Caddy left alone).
#
# Run ON the EC2/Lightsail host as ec2-user (or any user with passwordless sudo docker).
#
# Usage:
#   ./deploy.sh                  # update or bootstrap with defaults
#   ./deploy.sh --fresh-env      # recreate .env from env vars / prompts (keeps DB)
#   DOMAIN=littlebowl.in ACME_EMAIL=you@example.com ./deploy.sh
set -euo pipefail

DOMAIN="${DOMAIN:-littlebowl.in}"
ACME_EMAIL="${ACME_EMAIL:-swetaattri@gmail.com}"
REPO_URL="${REPO_URL:-https://github.com/swetaattri073/kabirmealplanner.git}"
REPO_DIR="${REPO_DIR:-$HOME/kabirmealplanner}"
APP_DIR="${APP_DIR:-$REPO_DIR/toddler-meal-planner}"
MEAL_DATA_DIR="${MEAL_DATA_DIR:-$HOME/meal-data}"
GIT_REF="${GIT_REF:-main}"
NETWORK_NAME="${NETWORK_NAME:-littlebowl-net}"
APP_IMAGE="${APP_IMAGE:-meal-planner}"
APP_CONTAINER="${APP_CONTAINER:-meal-planner}"
CADDY_CONTAINER="${CADDY_CONTAINER:-caddy}"
FRESH_ENV=0

for arg in "$@"; do
  case "$arg" in
    --fresh-env) FRESH_ENV=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

log() { printf '\n==> %s\n' "$*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

ensure_docker() {
  if need_cmd docker && docker info >/dev/null 2>&1; then
    return 0
  fi
  log "Installing Docker"
  if need_cmd yum; then
    sudo yum update -y
    sudo yum install -y docker git
  elif need_cmd apt-get; then
    sudo apt-get update -y
    sudo apt-get install -y docker.io git
  else
    echo "Unsupported OS: install Docker + git manually" >&2
    exit 1
  fi
  sudo systemctl enable --now docker
  if ! groups | grep -qw docker; then
    sudo usermod -aG docker "$USER" || true
    echo "Added $USER to docker group. If docker commands fail, log out/in once." >&2
  fi
}

docker_cmd() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

ensure_repo() {
  if [[ ! -d "$REPO_DIR/.git" ]]; then
    log "Cloning $REPO_URL → $REPO_DIR"
    git clone "$REPO_URL" "$REPO_DIR"
  fi
  log "Updating repo to $GIT_REF"
  git -C "$REPO_DIR" fetch origin
  git -C "$REPO_DIR" checkout "$GIT_REF"
  git -C "$REPO_DIR" pull --ff-only origin "$GIT_REF" || \
    git -C "$REPO_DIR" reset --hard "origin/$GIT_REF"
}

write_env_if_needed() {
  mkdir -p "$MEAL_DATA_DIR/logs"
  local env_file="$MEAL_DATA_DIR/.env"
  if [[ -f "$env_file" && "$FRESH_ENV" -eq 0 ]]; then
    log "Keeping existing $env_file"
    return 0
  fi
  log "Writing $env_file"
  local secret
  secret="$(openssl rand -hex 32)"
  if [[ -f "$env_file" && -n "${SECRET_KEY:-}" ]]; then
    secret="$SECRET_KEY"
  elif [[ -f "$env_file" ]]; then
    # Preserve previous SECRET_KEY when regenerating other flags
    secret="$(grep -E '^SECRET_KEY=' "$env_file" | head -1 | cut -d= -f2- || true)"
    [[ -n "$secret" ]] || secret="$(openssl rand -hex 32)"
  elif [[ -n "${SECRET_KEY:-}" ]]; then
    secret="$SECRET_KEY"
  fi

  cat > "$env_file" <<EOF
FLASK_ENV=production
SECRET_KEY=${secret}
FORCE_HTTPS=true
SESSION_COOKIE_SECURE=true
FEATURE_CHAT_ENABLED=${FEATURE_CHAT_ENABLED:-true}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
ADMIN_EMAILS=${ADMIN_EMAILS:-}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
USDA_FDC_API_KEY=${USDA_FDC_API_KEY:-}
EOF
  chmod 600 "$env_file"
}

ensure_network() {
  if ! docker_cmd network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    log "Creating docker network $NETWORK_NAME"
    docker_cmd network create "$NETWORK_NAME"
  fi
}

build_app() {
  log "Building image $APP_IMAGE"
  docker_cmd build -t "$APP_IMAGE" "$APP_DIR"
}

restart_app() {
  log "Recreating container $APP_CONTAINER"
  docker_cmd rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
  docker_cmd run -d --name "$APP_CONTAINER" --restart always \
    --network "$NETWORK_NAME" \
    -v "$MEAL_DATA_DIR:/app/instance" \
    --env-file "$MEAL_DATA_DIR/.env" \
    -e FLASK_ENV=production \
    -e FORCE_HTTPS=true \
    -e SESSION_COOKIE_SECURE=true \
    "$APP_IMAGE"
}

ensure_caddy() {
  if docker_cmd inspect "$CADDY_CONTAINER" >/dev/null 2>&1; then
    local running
    running="$(docker_cmd inspect -f '{{.State.Running}}' "$CADDY_CONTAINER" 2>/dev/null || echo false)"
    if [[ "$running" == "true" ]]; then
      log "Caddy already running — leaving it alone"
      return 0
    fi
  fi

  log "Starting Caddy for https://$DOMAIN (proxy → ${APP_CONTAINER}:5000)"
  mkdir -p "$MEAL_DATA_DIR/caddy"
  cat > "$MEAL_DATA_DIR/caddy/Caddyfile" <<EOF
{
    email ${ACME_EMAIL}
}
${DOMAIN} {
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options nosniff
        -Server
    }
    reverse_proxy ${APP_CONTAINER}:5000 {
        header_up X-Real-IP {remote_host}
    }
}
EOF

  docker_cmd rm -f "$CADDY_CONTAINER" >/dev/null 2>&1 || true
  docker_cmd run -d --name "$CADDY_CONTAINER" --restart always \
    --network "$NETWORK_NAME" \
    -p 80:80 -p 443:443 -p 443:443/udp \
    -v "$MEAL_DATA_DIR/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
    -v caddy_data:/data \
    -v caddy_config:/config \
    caddy:2.8-alpine
}

wait_healthy() {
  log "Waiting for app health"
  local i
  for i in $(seq 1 30); do
    if docker_cmd exec "$APP_CONTAINER" curl -fsS http://127.0.0.1:5000/ >/dev/null 2>&1; then
      echo "App is up"
      return 0
    fi
    sleep 2
  done
  echo "App did not become healthy in time" >&2
  docker_cmd logs --tail 50 "$APP_CONTAINER" || true
  return 1
}

verify_db() {
  log "Verifying SQLite + food seed"
  docker_cmd exec "$APP_CONTAINER" python3 - <<'PY'
from sqlalchemy import inspect
from app import app
from models import Food, db
with app.app_context():
    tables = inspect(db.engine).get_table_names()
    print("db_tables", len(tables))
    print("food_count", Food.query.count())
    print("has_chat_usage", "chat_usage" in tables)
    assert Food.query.count() > 50, "food seed missing"
PY
}

print_status() {
  log "Status"
  docker_cmd ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  echo
  echo "Data dir: $MEAL_DATA_DIR"
  echo "DB file:  $MEAL_DATA_DIR/toddler_meals.db"
  echo "Site:     https://$DOMAIN/"
  curl -fsS -o /dev/null -w "HTTPS status: %{http_code}\n" "https://$DOMAIN/" || \
    echo "HTTPS not ready yet (DNS / cert). App container is still running."
}

main() {
  ensure_docker
  if ! need_cmd git; then
    if need_cmd yum; then sudo yum install -y git; else sudo apt-get install -y git; fi
  fi
  ensure_repo
  write_env_if_needed
  ensure_network
  build_app
  restart_app
  ensure_caddy
  wait_healthy
  verify_db
  print_status
  log "Deploy complete"
}

main
