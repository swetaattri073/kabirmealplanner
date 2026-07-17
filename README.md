# LittleBowl

Personalized meal planning for Indian toddlers — **Little meals, big growth.**

This repository contains **one production app** and an optional React prototype that shares the same LittleBowl look.

| Path | What it is | Deploy this? |
|------|------------|--------------|
| **`toddler-meal-planner/`** | **Complete LittleBowl app** (Flask + SQLite + PWA): email/password auth, meal logging, weekly plans, NLP/photo, recipes, food-safety, USDA lookups, audit logs; AI chat is Premium / coming soon | **Yes — production** |
| Repo root (`src/`, `server/`) | Earlier React prototype — features ported into Flask. Reference only | Optional / local |

**Full docs:**  
→ [`toddler-meal-planner/README.md`](toddler-meal-planner/README.md)  
→ [`toddler-meal-planner/DEPLOYMENT.md`](toddler-meal-planner/DEPLOYMENT.md)

---

## Tech stack (production)

- **Backend:** Python, Flask, SQLAlchemy, Flask-Login
- **Database:** SQLite (default, Docker volume) or PostgreSQL
- **Auth:** Email/password (social login removed for now)
- **Frontend:** Jinja2, HTML/CSS, vanilla JS, PWA
- **AI:** OpenAI chat (Premium-only, feature-flagged / coming soon)
- **Deploy:** Docker / gunicorn (also Render, Railway, Fly, AWS)

---

## Deploy the complete app (Flask LittleBowl)

```bash
cd ~/kabirmealplanner && git pull origin main
cd toddler-meal-planner

mkdir -p ~/meal-data
cp -n .env.example ~/meal-data/.env
# edit ~/meal-data/.env → SECRET_KEY, OPENAI_API_KEY

sudo docker build -t meal-planner .
sudo docker stop meal-planner 2>/dev/null; sudo docker rm meal-planner 2>/dev/null
sudo docker run -d --name meal-planner --restart always \
  -p 80:5000 \
  -v ~/meal-data:/app/instance \
  --env-file ~/meal-data/.env \
  meal-planner
```

- App: `http://YOUR_SERVER_IP`
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

## Recent product notes

- AI Chat Assistant is a **Premium** feature (Coming soon on Account); hidden behind `FEATURE_CHAT_ENABLED`  
- Chat plan updates only touch **future unlogged** slots; meal history is separate  
- Secrets belong in **`~/meal-data/.env`**, not one-off `docker run -e` flags  
- Sign-in is **email/password only** for now  

---

## React prototype (optional)

```bash
npm install
npm run dev      # UI
npm run server   # USDA + OpenAI proxy
```

Not required for production. See root `.env.example` for `OPENAI_API_KEY` / `USDA_FDC_API_KEY`.
