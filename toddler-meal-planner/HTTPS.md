# HTTPS setup for littlebowl.in (required for App Store / Play + Secure cookies)

Today `http://littlebowl.in` works, but **HTTPS does not** (no certificate on port 443).
Store apps and Secure session cookies need TLS.

## What I need from you

Pick **one** of these (fastest first):

### Option A — Cloudflare (no server SSH)
1. Put `littlebowl.in` DNS on Cloudflare (or enable proxy on the existing A record → `15.252.35.8`).
2. SSL/TLS mode: **Full** (or Full Strict after Caddy is up).
3. Tell me when the orange-cloud proxy is on — then `https://littlebowl.in` should respond.

### Option B — Let’s Encrypt on the VPS (best long-term)
I need either:
- **SSH access** to the VPS (`15.252.35.8`) as a user that can run Docker, **or**
- You run the commands below yourself on the server.

Firewall must allow **80** and **443**.

```bash
cd /path/to/kabirmealplanner/toddler-meal-planner   # your checkout
git pull origin main

# Secrets / cookie flags (persist across redeploys)
mkdir -p ~/meal-data
cat >> ~/meal-data/.env <<'EOF'
FORCE_HTTPS=true
SESSION_COOKIE_SECURE=true
EOF

export DOMAIN=littlebowl.in
export ACME_EMAIL=YOUR_REAL_EMAIL@example.com   # for Let's Encrypt notices

docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Verify:

```bash
curl -I https://littlebowl.in/
# Expect: HTTP/2 200  and  set-cookie: ... Secure
```

### Option C — Hand me SSH
Reply with how to connect (host + user). Do **not** paste the private key in chat if you can add my deploy key / temporarily allow the cloud agent IP instead.

## What this repo already does after merge

- `FORCE_HTTPS=true` → HTTP redirects to HTTPS; Secure cookies for session / remember-me / guest id
- Caddy (`docker-compose.https.yml` + `Caddyfile`) auto-issues Let’s Encrypt certs
- Native apps point at `https://littlebowl.in/home` (no cleartext / no ATS HTTP exception)

## Rebuild native apps **after** HTTPS works

```bash
cd toddler-meal-planner/android-app
npm run configure -- https://littlebowl.in/home
npm run sync
```
