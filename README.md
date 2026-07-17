# LittleBowl

Personalized meal planning for Indian toddlers — **Little meals, big growth.**

This repository contains **one production app** and an optional React prototype that shares the same LittleBowl look.

| Path | What it is | Deploy this? |
|------|------------|--------------|
| **`toddler-meal-planner/`** | **Complete LittleBowl app** (Flask + SQLite + PWA): auth, meal logging, weekly plans, NLP/photo, install popup, branding | **Yes — this is production** |
| Repo root (`src/`, `server/`) | React experiment (localStorage + USDA/OpenAI proxy). Same LittleBowl colors/logo; **not** a feature-complete replacement | Optional / local only |

---

## Deploy the complete app (Flask LittleBowl)

Use these commands on your server. This keeps your existing UI, data, and features.

```bash
cd ~/kabirmealplanner && git pull origin main
cd toddler-meal-planner

sudo docker build -t meal-planner .
sudo docker stop meal-planner 2>/dev/null; sudo docker rm meal-planner 2>/dev/null
sudo docker run -d --name meal-planner --restart always \
  -p 80:5000 \
  -v ~/meal-data:/app/instance \
  meal-planner
```

- App URL: `http://YOUR_SERVER_IP`
- Meal data persists in `~/meal-data` (do not remove this volume)
- More options (Render, Lightsail, etc.): see [`toddler-meal-planner/DEPLOYMENT.md`](toddler-meal-planner/DEPLOYMENT.md)

### First-time setup (if the repo is not on the server yet)

```bash
sudo yum update -y   # or apt update
sudo yum install -y docker git   # or apt install docker.io git
sudo systemctl start docker && sudo systemctl enable docker

git clone https://github.com/swetaattri073/kabirmealplanner.git
cd kabirmealplanner/toddler-meal-planner
# then run the docker build / run commands above
```

---

## React prototype (optional — same LittleBowl branding)

Styled to match Flask LittleBowl (Nunito, purple/pink gradient, logo mark). Functionality is the separate React planner (profiles in the browser, USDA nutrition, chat). It does **not** replace the Flask production features.

### Local development

```bash
npm install
npm run dev      # terminal 1 — UI
npm run server   # terminal 2 — USDA + OpenAI proxy
```

Optional `.env` at the repo root (see `.env.example`):

- `USDA_FDC_API_KEY` — real nutrition data (falls back to USDA `DEMO_KEY`)
- `OPENAI_API_KEY` — enables the Chat tab

### Optional React Docker (not production)

From the **repo root** only if you intentionally want the React prototype:

```bash
cd ~/kabirmealplanner
cp .env.example .env   # optional API keys
sudo docker build -t littlebowl-app .
sudo docker run -d --name littlebowl-app --restart always \
  -p 8080:5000 --env-file .env littlebowl-app
```

Use port **8080** (or another free port) so it does not conflict with Flask on port 80.

### Project structure (React)

- `src/foodEngine.js` — weekly plan rules engine
- `src/defaultProfile.js` — starter profiles + recipes
- `src/foodSafety.js` — age-appropriate safety flags
- `src/nutritionApi.js` / `server/` — USDA + OpenAI proxy
- `src/App.jsx` — UI (LittleBowl-branded)

---

## Important

- **Production users should only deploy `toddler-meal-planner/`.**
- Do not run Flask and a root-level React container both on port 80 at once.
- Keep using `-v ~/meal-data:/app/instance` so you do not lose logged meals.
