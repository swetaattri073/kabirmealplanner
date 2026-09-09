# LittleBowl server deploy + data migrate

Scripts that match the production path that already worked on Lightsail:
manual `docker build` + `meal-planner` / `caddy` containers (not `docker-compose --build`).

| Script | Where you run it | Purpose |
|--------|------------------|---------|
| `deploy.sh` | On the EC2 host | Fresh install **or** update (idempotent) |
| `remote-deploy.sh` | Mac / CI / Cursor agent | SSH wrapper that uploads + runs `deploy.sh` |
| `migrate-export.sh` | Old server | Pack `~/meal-data` (DB + `.env` + uploads) |
| `migrate-import.sh` | New server | Restore that pack into `~/meal-data` |

## One-time: give Cursor / GitHub permission to deploy

I cannot SSH to your EC2 until a deploy key exists as a secret.

### GitHub Actions (recommended)

Repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Value |
|--------|--------|
| `DEPLOY_HOST` | New EC2 public IP (or DNS) |
| `DEPLOY_SSH_KEY` | Full contents of the `.pem` private key |
| `DOMAIN` | `littlebowl.in` (optional) |
| `ACME_EMAIL` | Let's Encrypt email (optional) |
| `OPENAI_API_KEY` | Only needed on **first** boot |
| `ADMIN_EMAILS` / `ADMIN_PASSWORD` | Only needed on **first** boot |

Then: **Actions → Deploy LittleBowl to EC2 → Run workflow**.

### Cursor Cloud Agent

Store the same values as **Cloud Agent / environment secrets** (or tell the agent the host + that the key is available). After that, saying “deploy latest to the server” is enough: the agent runs `remote-deploy.sh`.

Security group on the EC2 must allow **SSH (22)** from GitHub Actions IPs *or* (simpler) from `0.0.0.0/0` for port 22 only if you accept that tradeoff — better: restrict to your IP + enable Actions deploy from a self-hosted runner later. For a first setup, allow your IP for manual SSH; for Actions, either temporarily open 22 or use a bastion.

## Fresh server (empty DB)

On the new EC2 (Amazon Linux 2023, ports **22 / 80 / 443** open, DNS A record for `littlebowl.in` already pointed here):

```bash
# Option A — from your Mac (after cloning the repo)
cd toddler-meal-planner/scripts/deploy
chmod +x *.sh
DEPLOY_HOST=NEW_IP DEPLOY_SSH_KEY=~/.ssh/new-key.pem \
  OPENAI_API_KEY=sk-... ADMIN_EMAILS=you@example.com ADMIN_PASSWORD='...' \
  ./remote-deploy.sh
```

Or Option B — SSH in and run locally:

```bash
curl -fsSL -o /tmp/deploy.sh \
  https://raw.githubusercontent.com/swetaattri073/kabirmealplanner/main/toddler-meal-planner/scripts/deploy/deploy.sh
# (or scp the script from your laptop)
chmod +x /tmp/deploy.sh
OPENAI_API_KEY=sk-... ADMIN_EMAILS=you@example.com ADMIN_PASSWORD='...' \
  /tmp/deploy.sh
```

This creates tables via `db.create_all()` and seeds foods automatically.

## Migrate data when servers cannot talk (Mac as bridge)

### 1. Old server — export

```bash
# copy migrate-export.sh up, or use the copy in the cloned repo
cd ~/kabirmealplanner/toddler-meal-planner/scripts/deploy
chmod +x migrate-export.sh
./migrate-export.sh
# → ~/littlebowl-migrate-YYYYMMDD-HHMMSS.tgz
```

### 2. Your Mac — download, then upload to new server

```bash
scp -i ~/.ssh/old-key.pem ec2-user@OLD_IP:~/littlebowl-migrate-*.tgz .
scp -i ~/.ssh/new-key.pem littlebowl-migrate-*.tgz ec2-user@NEW_IP:~/
```

### 3. New server — import data, then deploy (or the reverse)

**Preferred (no empty DB flash):** put `meal-data` in place, then deploy.

```bash
# on new server, after scp of the tarball
chmod +x migrate-import.sh   # from repo or scp the script alone
./migrate-import.sh ~/littlebowl-migrate-YYYYMMDD-HHMMSS.tgz

# then start / update the app (reuses imported DB + .env)
/tmp/littlebowl-deploy.sh
# or from Mac: ./remote-deploy.sh
```

**Alternate:** deploy first (creates a fresh seeded DB), then import (replaces it with the old DB). Import keeps the old `.env` (including `SECRET_KEY`) and `toddler_meals.db`.

### 4. Cut DNS

Point `littlebowl.in` A record to the **new** IP, wait for TLS, then:

```bash
curl -sI https://littlebowl.in/ | head
curl -s https://littlebowl.in/api/auth/status
```

## Later: “deploy latest”

Same command every time (idempotent — rebuilds `meal-planner`, leaves Caddy alone):

```bash
DEPLOY_HOST=YOUR_IP DEPLOY_SSH_KEY=~/.ssh/key.pem GIT_REF=main \
  ./remote-deploy.sh
```

Or GitHub Actions → **Run workflow**.

## What gets created automatically

| Item | How |
|------|-----|
| SQLite file `~/meal-data/toddler_meals.db` | First app start |
| All tables | `db.create_all()` |
| Food catalog | `init_food_database()` |
| Users / meal logs | App usage **or** migrate-import |
| HTTPS | Caddy → `meal-planner:5000` |
