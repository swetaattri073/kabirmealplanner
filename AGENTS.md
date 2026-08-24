# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
LittleBowl is a meal-planning app for Indian toddlers. There is **one production app**:
the Flask + SQLite web app in `toddler-meal-planner/` (server-rendered Jinja2 + PWA + JSON API).
Everything else is optional: the repo-root `src/` + `server/index.js` is a reference React/Vite
prototype, and `toddler-meal-planner/mobile/` (Expo) + `toddler-meal-planner/android-app/`
(legacy Capacitor) are optional native clients.

### Services and how to run them

| Service | Path | Run (dev) | Notes |
|---------|------|-----------|-------|
| Flask app (core product) | `toddler-meal-planner/` | `toddler-meal-planner/.venv/bin/python toddler-meal-planner/app.py` | Serves http://localhost:5000 with debug + hot reload |
| React/Vite prototype (optional) | repo root | `npm run dev` (UI), `npm run server` (USDA/OpenAI proxy, port 8787) | Reference only, not production |
| Expo mobile / Capacitor app (optional) | `toddler-meal-planner/mobile/`, `.../android-app/` | see their READMEs | Deps NOT installed by the update script; heavy Android/Expo toolchain |

### Non-obvious caveats
- Python deps live in a venv at `toddler-meal-planner/.venv` (created by the update script).
  The `python3.12-venv` system package is required to create it; it is installed during
  environment setup and persisted in the VM snapshot, so the update script does not reinstall it.
- The Flask app **auto-creates and seeds** its SQLite DB (`toddler-meal-planner/instance/toddler_meals.db`)
  and the food catalog on every boot via `db.create_all()` + `init_food_database()`. There are no
  migrations to run. To reset, delete the `instance/` folder (it is gitignored).
- Lint (`npm run lint` at repo root) scans BOTH the root prototype and `toddler-meal-planner/static/*.js`.
  It currently reports ~115 pre-existing errors (mostly unused `e` in catch blocks and a
  service-worker `clients` global); these are pre-existing, not caused by your changes.
- `npm run build` (Vite) only builds the optional root prototype; it is not needed for the Flask app.
- Auth is email/password only. The AI chat assistant is Premium-only and hidden behind
  `FEATURE_CHAT_ENABLED=true` (default off) and needs `OPENAI_API_KEY`. USDA lookups fall back to a
  public `DEMO_KEY` when `USDA_FDC_API_KEY` is unset.
- `SECRET_KEY` is auto-generated into `instance/.env` on first boot if missing; no secret is required
  to run locally.
