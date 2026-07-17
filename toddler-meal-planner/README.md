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
| Auth | Email/password (**bcrypt**), **Google** + **Facebook/Instagram** OAuth via **Authlib** |
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
- Audit-friendly logging hooks when present on deployed branches (`instance/logs/`, `audit_logs` API)

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
| `~/meal-data/.env` | `/app/instance/.env` | Secrets (`OPENAI_API_KEY`, OAuth, `SECRET_KEY`) |
| `~/meal-data/logs/` | `/app/instance/logs/` | App/audit log files (when audit logging is enabled) |

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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For Google login | See social login below |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | For Facebook login | See social login below |
| `SESSION_COOKIE_SECURE` | No | Set `true` only behind HTTPS |
| `FLASK_ENV` | No | `production` in Docker |

---

## Social logins (Google & Facebook / Instagram)

Email/password signup works without any OAuth setup. Social buttons stay **disabled** until the env vars below are set and the container is restarted.

**Important:** Google and Meta almost always require **HTTPS** and a real domain for production redirect URIs. Use `http://localhost:5000/...` only for local testing. Put OAuth secrets in `~/meal-data/.env`, then redeploy with `--env-file`.

### What you need

1. A public **HTTPS** site (recommended), e.g. `https://yourdomain.com`
2. Provider **Client ID** + **Client Secret**
3. Exact **Authorized redirect URIs** matching the app:
   - Google → `https://YOUR_DOMAIN/authorize/google`
   - Facebook → `https://YOUR_DOMAIN/authorize/facebook`
4. Env vars in `.env`, then restart Docker

Callback paths are fixed in the app (`/authorize/google`, `/authorize/facebook`). Login starts at `/login/google` and `/login/facebook`.

---

### Google Sign-In — how to get credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. **APIs & Services → OAuth consent screen**
   - User type: **External** (or Internal for Workspace-only)
   - App name, support email, developer contact
   - Scopes: default email/profile is enough (`openid`, `email`, `profile`)
   - Add test users while the app is in **Testing**
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: e.g. `LittleBowl`
   - **Authorized JavaScript origins:** `https://YOUR_DOMAIN` (and `http://localhost:5000` for local)
   - **Authorized redirect URIs:**
     - `https://YOUR_DOMAIN/authorize/google`
     - `http://localhost:5000/authorize/google` (local only)
5. Copy **Client ID** and **Client Secret** into `.env`:

```bash
GOOGLE_CLIENT_ID=........apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=........
```

6. Restart the app. Google button on Login/Signup should enable.
7. When ready for all users: Consent screen → **Publish app** (Google may require verification for sensitive scopes; basic sign-in is usually fine).

---

### Facebook / Instagram Sign-In — how to get credentials

Consumer **Instagram** login in this app uses **Facebook Login** (Meta). You configure one Facebook app; Instagram appears as the same Meta login flow.

1. Open [Meta for Developers](https://developers.facebook.com/)
2. **My Apps → Create App** → type suitable for consumer login (e.g. **Consumer**)
3. Add product: **Facebook Login** → **Web**
4. **Facebook Login → Settings**
   - **Valid OAuth Redirect URIs:**
     - `https://YOUR_DOMAIN/authorize/facebook`
     - `http://localhost:5000/authorize/facebook` (local)
5. **App settings → Basic**
   - Copy **App ID** → `FACEBOOK_CLIENT_ID`
   - Copy **App Secret** → `FACEBOOK_CLIENT_SECRET`
   - Add **App Domains**: `YOUR_DOMAIN`
   - Privacy Policy URL (required before Live mode)
6. Permissions: request **`email`** (and public profile). In Development mode only roles/testers can log in. For public use: switch app to **Live** and complete App Review if Meta asks for `email`.
7. Env:

```bash
FACEBOOK_CLIENT_ID=........
FACEBOOK_CLIENT_SECRET=........
```

8. Restart Docker. Facebook button enables; Instagram note on the UI means “sign in with Meta/Facebook.”

---

### Social login checklist

| Step | Google | Facebook |
|------|--------|----------|
| Create cloud/dev app | Cloud Console project | Meta app |
| Redirect URI | `/authorize/google` | `/authorize/facebook` |
| Env vars | `GOOGLE_CLIENT_*` | `FACEBOOK_CLIENT_*` |
| HTTPS in production | Strongly required | Strongly required |
| Publish / Live | Consent screen publish | App Live + review as needed |
| Restart container after editing `.env` | Yes | Yes |

**Local tip:** For OAuth on `localhost`, add the localhost redirect URIs above. For a public IP over plain HTTP, providers often block redirects — use a domain + Let’s Encrypt (see `DEPLOYMENT.md`) or a tunnel (e.g. ngrok) pointed at your server.

**Behind a reverse proxy:** ensure Flask generates `https://...` external URLs (proxy `X-Forwarded-Proto` / `ProxyFix`, or set your public URL correctly). Wrong scheme/host → `redirect_uri_mismatch`.

---

## Useful API endpoints

| Area | Endpoints |
|------|-----------|
| Auth status | `GET /api/auth/status` |
| Toddlers / foods / meal logs | `/api/toddlers`, `/api/foods`, `/api/meal-logs` |
| Nutrition | `/api/nutrition/daily\|weekly\|alerts/:id` |
| Plans | `GET /api/meal-plan/weekly/:id` (`?regenerate=true`) |
| Chat | `GET /api/chat/health`, `POST /api/chat`, `POST /api/chat/summarize` |
| Safety / recipes / USDA | `/api/food-safety/*`, recipes pages, `/api/nutrition/usda/*` |

---

## Data model (high level)

- **`users`** — accounts (password and/or OAuth)
- **`toddlers`** — profiles (user-owned or anonymous `session_id`)
- **`foods`** — catalog + user-added foods
- **`meal_logs`** — what was actually eaten (never deleted by plan regenerate)
- **`weekly_plans`** — planned slots
- **`food_preferences`** — learned likes/dislikes

---

## PWA (install on phone)

- **Android Chrome:** menu → Add to Home Screen  
- **iPhone Safari:** Share → Add to Home Screen  

---

## License

MIT
