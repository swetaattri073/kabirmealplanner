# LittleBowl

Personalized meal planning for Indian toddlers — **Little meals, big growth.**

This repository contains **one production app** and an optional React prototype that shares the same LittleBowl look.

| Path | What it is | Deploy this? |
|------|------------|--------------|
| **`toddler-meal-planner/`** | **Complete LittleBowl app** (Flask + SQLite + PWA): auth, social login, meal logging, weekly plans, NLP/photo, recipes, food-safety, floating OpenAI chat with session memory, USDA lookups | **Yes — production** |
| Repo root (`src/`, `server/`) | Earlier React prototype — features ported into Flask. Reference only | Optional / local |

**Full docs (features, tech stack, deploy, social login):**  
→ [`toddler-meal-planner/README.md`](toddler-meal-planner/README.md)  
→ [`toddler-meal-planner/DEPLOYMENT.md`](toddler-meal-planner/DEPLOYMENT.md)

---

## Tech stack (production)

- **Backend:** Python, Flask, SQLAlchemy, Flask-Login, Authlib (OAuth)
- **Database:** SQLite (default, Docker volume) or PostgreSQL
- **Frontend:** Jinja2, HTML/CSS, vanilla JS, PWA
- **AI:** OpenAI chat (+ rolling chat summaries)
- **Deploy:** Docker / gunicorn (also Render, Railway, Fly, AWS)

---

## Deploy the complete app (Flask LittleBowl)

```bash
cd ~/kabirmealplanner && git pull origin main
cd toddler-meal-planner

mkdir -p ~/meal-data
cp -n .env.example ~/meal-data/.env
# edit ~/meal-data/.env → SECRET_KEY, OPENAI_API_KEY,
# and optionally GOOGLE_* / FACEBOOK_* for social login

sudo docker build -t meal-planner .
sudo docker stop meal-planner 2>/dev/null; sudo docker rm meal-planner 2>/dev/null
sudo docker run -d --name meal-planner --restart always \
  -p 80:5000 \
  -v ~/meal-data:/app/instance \
  --env-file ~/meal-data/.env \
  meal-planner
```

- App: `http://YOUR_SERVER_IP` (use HTTPS + a domain for social login)
- **DB + `.env` stay in `~/meal-data`** across redeploys

### First-time server setup

```bash
sudo yum update -y   # or apt update
sudo yum install -y docker git   # or apt install docker.io git
sudo systemctl start docker && sudo systemctl enable docker

git clone https://github.com/swetaattri073/kabirmealplanner.git
cd kabirmealplanner/toddler-meal-planner
# then docker build / run above
```

---

## Social logins — what you need

Buttons on Login/Signup stay disabled until credentials are configured.

| Provider | Get credentials | Env vars | Redirect URI to register |
|----------|-----------------|----------|---------------------------|
| **Google** | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth Web client | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `https://YOUR_DOMAIN/authorize/google` |
| **Facebook / Instagram** | [Meta for Developers](https://developers.facebook.com/) → Facebook Login | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | `https://YOUR_DOMAIN/authorize/facebook` |

1. Create the OAuth app at the provider  
2. Add the **exact** redirect URI (HTTPS in production)  
3. Put Client ID/Secret in `~/meal-data/.env`  
4. Redeploy / restart the container  

**Instagram** consumer sign-in uses **Facebook Login** (same Meta app).  
Step-by-step screenshots-level guide: [`toddler-meal-planner/README.md`](toddler-meal-planner/README.md#social-logins-google--facebook--instagram).

---

## Recent product notes

- Chat keeps the **last 10 messages** per visit and **summarizes** older turns; clears after **session end** or **15 min** inactivity  
- Chat plan updates only touch **future unlogged** slots; meal history is separate  
- Secrets belong in **`~/meal-data/.env`**, not one-off `docker run -e` flags  

---

## React prototype (optional)

```bash
npm install
npm run dev      # UI
npm run server   # USDA + OpenAI proxy
```

Not required for production. See root `.env.example` for `OPENAI_API_KEY` / `USDA_FDC_API_KEY`.
