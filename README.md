# Toddler Meal Planner

A weekly meal planner for toddlers (and infants starting solids) with picky-eating support: safe foods that never get silently removed just for being refused, gentle repeated exposure to new foods, real nutrition data pulled from USDA FoodData Central, built-in safety flags for foods that aren't recommended at this age (with safer alternatives), and a chat assistant for quick questions.

Multiple toddlers can have their own profile, each with its own food pool, plan settings (how adventurous/varied the rotation is), and history.

## Running it

This app has two parts that both need to be running:

1. **The app itself** (React + Vite):
   ```
   npm install
   npm run dev
   ```
2. **The nutrition data proxy** (a small Node server, no extra install needed - see "Nutrition data" below):
   ```
   npm run server
   ```

Run both in separate terminals. The app works fine without the proxy running - you just won't get real nutrition numbers, and the Foods tab will show a note about it.

## Nutrition data

Nutrition numbers (calories, protein, iron, etc.) come from [USDA FoodData Central](https://fdc.nal.usda.gov/), looked up per ingredient and summed per serving - a composite dish like "Paneer paratha + dahi" is broken into its ingredients (see the `ingredients` field on each food in `src/defaultProfile.js`) since a whole dish name won't match a nutrition database on its own.

FoodData Central doesn't support browser CORS requests and its API key shouldn't be shipped in client code, so `server/index.js` is a small local proxy that holds the key and forwards just the two calls the app needs. The Vite dev server forwards `/api/*` requests to it automatically (see `vite.config.js`).

**To get real (non-demo) data:**
1. Sign up for a free API key: https://fdc.nal.usda.gov/api-key-signup/
2. Copy `.env.example` to `.env` in the project root and paste your key in as `USDA_FDC_API_KEY=...`
3. Restart `npm run server`

Without a key, the proxy falls back to USDA's public `DEMO_KEY`, capped at 30 requests/hour and 50/day - fine for trying things out, too low for regularly refreshing a full food list.

In the app, each food in the **Foods** tab has a "Look up nutrition" button, and there's a "Refresh nutrition for all foods" button to update everything at once (useful after adding a new API key, or periodically since USDA occasionally revises its data). Results are cached in the browser for 30 days so refreshing doesn't burn through the rate limit.

## Safety notes

The **Foods** tab also flags anything not recommended for infants/toddlers - choking hazards by shape/texture (whole grapes, hot dog coins, whole nuts, firm raw veg), honey (infant botulism risk), high-mercury fish, caffeine, unpasteurized dairy/juice, undercooked protein, added salt/sugar, and cow's milk as a primary drink before 12 months. Each flag comes with a reason and a concrete safer alternative (e.g. "quarter grapes lengthwise" or "use ground almonds instead of whole"). This is general public-health guidance, not a medical assessment of your specific child - see `src/foodSafety.js` for the full rule set.

## Chat assistant

The **Chat** tab lets you ask things like "what's today's plan?", "should I give him honey?", or just tell it "she doesn't eat broccoli" / "he's been picky all week" - it'll log that feedback against the matching food (or as a general note) the same way the in-app "Refused/Tried a little/Ate it" buttons do, so it feeds into future planning.

This is powered by OpenAI (you chose this over Claude or a rule-based/offline option). It needs its own API key, separate from any Claude.ai/Cowork access:

1. Get an API key: https://platform.openai.com/api-keys (pay-per-use; a personal app like this costs a few cents per conversation with a small model)
2. Add it to your `.env` file: `OPENAI_API_KEY=yourkeyhere`
3. Restart `npm run server`

Without a key, the Chat tab shows a message explaining it isn't configured yet - there's no free demo fallback the way there is for USDA. You can optionally set `OPENAI_CHAT_MODEL` in `.env` to use a different model (defaults to `gpt-4o-mini`, a low-cost option).

The chat only ever gets one tool it can call (`log_food_feedback`) - it can't take any other action in the app, and every reply is grounded in the *real* current plan/food list/safety rules that get rebuilt into its instructions on every message, not a stale snapshot.

## Project structure

- `src/foodEngine.js` - pure rules engine: generates the weekly rotation from a food pool + settings, logs parent feedback, computes the "smart tip". No React, no network - unit-testable on its own.
- `src/defaultProfile.js` - starter profiles (toddler example, 6-months+ purees) and the recipe library. Just data - freely editable from the app.
- `src/foodSafety.js` - the not-recommended-for-this-age rule set (reason + recommendation + safer alternative per rule).
- `src/nutritionApi.js` - client-side nutrition lookups/aggregation/caching, talking to the local proxy.
- `src/chatApi.js` / `src/chatAssistant.js` - client-side chat: talking to the proxy, building the system prompt from the live profile/plan/safety rules, the one tool definition, and fuzzy food-name matching.
- `server/index.js` - the local proxy: USDA FoodData Central + OpenAI, both keys held server-side.
- `server/nutrients.js` / `server/chat.js` - pure per-service logic behind that proxy.
- `src/App.jsx` - the UI.

## Other scripts

- `npm run build` - production build
- `npm run lint` - eslint
- `npm run preview` - preview a production build
- `npm start` - production server (serves `dist/` + `/api/*` on port 5000)

## Docker deployment (this React app)

From the **repo root** (not `toddler-meal-planner/`):

```bash
cd ~/kabirmealplanner && git pull origin main

# Optional: copy API keys into .env at the repo root
cp .env.example .env
# edit .env — USDA_FDC_API_KEY and/or OPENAI_API_KEY

sudo docker build -t littlebowl-app .
sudo docker stop littlebowl-app 2>/dev/null; sudo docker rm littlebowl-app 2>/dev/null
sudo docker run -d --name littlebowl-app --restart always \
  -p 80:5000 \
  --env-file .env \
  littlebowl-app
```

Or with Compose:

```bash
cd ~/kabirmealplanner
docker compose up -d --build
```

The container serves the built React UI and the `/api/*` proxy on port 5000 (mapped to host port 80 above). Profile and meal data live in the browser's `localStorage` — no server volume is required.

## Legacy Flask app (`toddler-meal-planner/`)

The older **LittleBowl PWA** (Flask + SQLite) still lives in `toddler-meal-planner/`. Its Docker commands are unchanged — run them from that subdirectory:

```bash
cd ~/kabirmealplanner/toddler-meal-planner
sudo docker build -t meal-planner .
sudo docker stop meal-planner && sudo docker rm meal-planner
sudo docker run -d --name meal-planner --restart always \
  -p 80:5000 -v ~/meal-data:/app/instance meal-planner
```

Do not run both containers on host port 80 at the same time. Pick one app per server, or map different ports (e.g. `-p 8080:5000`).

## Environment files

Copy `.env.example` to `.env` at the repo root. `.env` holds your USDA and OpenAI keys and should never be committed.
