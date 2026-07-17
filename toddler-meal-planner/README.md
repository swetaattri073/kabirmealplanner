# LittleBowl (Toddler Meal Planner)

Personalized meal planning for Indian toddlers (about 6 months–5 years) — **Little meals, big growth.**

**Production app:** this folder (`toddler-meal-planner/`).  
The React app at the repo root is an optional prototype; features live here in Flask.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.8+, **Flask 3**, Flask-Login, Flask-CORS |
| ORM / DB | **SQLAlchemy** + **SQLite** by default (`instance/toddler_meals.db`); optional **PostgreSQL** via `DATABASE_URL` |
| Auth | Email/password (**bcrypt**) — social login removed for now |
| AI chat | **OpenAI** Chat Completions (`gpt-4o-mini` by default) |
| Nutrition extras | **USDA FoodData Central** API (optional), Open Food Facts enrichment |
| Frontend | Server-rendered **Jinja2** templates, HTML/CSS, vanilla JS, **PWA** (installable) |
| Deploy | **Docker** / Compose, **gunicorn**; also Render, Railway, Fly, Lightsail |
| Secrets & data | Docker volume `~/meal-data` → `/app/instance` (DB + `.env`) |

---

## Features (current)

### Profiles & diet
- Multi-toddler profiles (logged-in or anonymous session)
- Age-based schedules and ICMR-NIN style RDA targets
- Vegetarian / eggetarian / non-vegetarian filters
- Allergy hard-excludes from the food DB
- Large Indian food database with nutrients, allergens, servings, prep tips

### Logging & nutrition
- Log meals (multi-item), portions, reactions, notes, optional photo
- Edit / replace logged meals; history is never wiped by plan regenerate
- Daily + weekly nutrition, alerts, preference learning from reactions
- Custom foods + enrichment

### Weekly plans & recipes
- Auto-generated weekly plans (preferences, gaps, variety, diet)
- Chat can update **future unlogged** slots only
- Regenerate replaces future unlogged slots; past + already-logged kept
- Recipe cards for foods; plan meals link into Recipes

### Chat assistant
- Floating OpenAI assistant (tips + Q&A + plan tools + food feedback)
- **Session memory:** last **10** messages in `sessionStorage`; older turns summarized
- History wiped when the **browser session ends** or after **15 minutes** of site inactivity
- Needs `OPENAI_API_KEY`

### Safety & extras
- Food-safety rules (honey, choking hazards, etc.)
- USDA lookups (optional key)
- PWA “Add to Home Screen” prompt
- Audit logging to `instance/logs/` and `audit_logs` table (`GET /api/audit-logs/<toddler_id>`)

---

## Local development

```bash
cd toddler-meal-planner
python3 -m venv .venv && source .venv/bin/activate   # optional
pip install -r requirements.txt
cp .env.example .env
# edit .env — at least SECRET_KEY=... ; OPENAI_API_KEY=... for chat
python3 app.py
```

Open `http://localhost:5000`.

---

## Production deployment (Docker — recommended)

On your VPS (Lightsail, DigitalOcean, etc.):

```bash
# First time only
git clone https://github.com/swetaattri073/kabirmealplanner.git
cd kabirmealplanner/toddler-meal-planner

mkdir -p ~/meal-data
cp -n .env.example ~/meal-data/.env
# edit ~/meal-data/.env — see Environment variables below

sudo docker build -t meal-planner .
sudo docker stop meal-planner 2>/dev/null; sudo docker rm meal-planner 2>/dev/null
sudo docker run -d --name meal-planner --restart always \
  -p 80:5000 \
  -v ~/meal-data:/app/instance \
  --env-file ~/meal-data/.env \
  meal-planner
```

**Update / redeploy** (keeps DB + secrets):

```bash
cd ~/kabirmealplanner && git pull origin main
cd toddler-meal-planner
sudo docker build -t meal-planner .
sudo docker stop meal-planner && sudo docker rm meal-planner
sudo docker run -d --name meal-planner --restart always \
  -p 80:5000 \
  -v ~/meal-data:/app/instance \
  --env-file ~/meal-data/.env \
  meal-planner
```

| Host path | Container | Purpose |
|-----------|-----------|---------|
| `~/meal-data/toddler_meals.db` | `/app/instance/toddler_meals.db` | Users, toddlers, logs, plans |
| `~/meal-data/.env` | `/app/instance/.env` | Secrets (`OPENAI_API_KEY`, `SECRET_KEY`, …) |
| `~/meal-data/logs/` | `/app/instance/logs/` | App/audit log files |

More hosts (Render, App Runner, Fly): see [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Environment variables

Put these in **`~/meal-data/.env`** in production (or `toddler-meal-planner/.env` locally).

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `SECRET_KEY` | **Yes** (prod) | Flask sessions / cookies |
| `OPENAI_API_KEY` | For chat | OpenAI chat + summarization |
| `OPENAI_CHAT_MODEL` | No | Default `gpt-4o-mini` |
| `DATABASE_URL` | No | Default SQLite under `instance/` |
| `USDA_FDC_API_KEY` | No | Better USDA rate limits |
| `SESSION_COOKIE_SECURE` | No | Set `true` only behind HTTPS |
| `FLASK_ENV` | No | `production` in Docker |

Auth is **email/password only** (social login removed for now).

---

## Useful API endpoints

| Area | Endpoints |
|------|-----------|
| Auth status | `GET /api/auth/status` |
| Toddlers / foods / meal logs | `/api/toddlers`, `/api/foods`, `/api/meal-logs` |
| Nutrition | `/api/nutrition/daily\|weekly\|alerts/:id` |
| Plans | `GET /api/meal-plan/weekly/:id` (`?regenerate=true`) |
| Chat | `GET /api/chat/health`, `POST /api/chat`, `POST /api/chat/summarize` |
| Audit | `GET /api/audit-logs/<toddler_id>` |
| Safety / recipes / USDA | `/api/food-safety/*`, recipes pages, `/api/nutrition/usda/*` |

---

## Data model (high level)

- **`users`** — accounts (email/password)
- **`toddlers`** — profiles (user-owned or anonymous `session_id`)
- **`foods`** — catalog + user-added foods
- **`meal_logs`** — what was actually eaten (never deleted by plan regenerate)
- **`weekly_plans`** — planned slots
- **`food_preferences`** — learned likes/dislikes
- **`audit_logs`** — API/plan change history per toddler

---

## PWA (install on phone)

- **Android Chrome:** menu → Add to Home Screen  
- **iPhone Safari:** Share → Add to Home Screen  

---

## License

MIT
