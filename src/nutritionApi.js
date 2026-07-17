// Client-side glue for real nutrition data. Talks to the local proxy in
// server/index.js (never directly to USDA - see that file for why), caches
// resolved ingredients so repeated lookups/refreshes don't burn through the
// USDA rate limit, and sums per-ingredient nutrients (scaled by grams) into
// a per-serving total for a composite home-cooked dish.

const CACHE_KEY = "toddlerMealPlanner.nutritionCache.v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days - ingredient nutrition doesn't change often

// Falls back to an in-memory store outside the browser (e.g. tests) so this
// module doesn't require a DOM to be imported and exercised.
const memoryStore = new Map();
function getStorage() {
  if (typeof localStorage !== "undefined") return localStorage;
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, v),
  };
}

function readCache() {
  try {
    return JSON.parse(getStorage().getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache) {
  getStorage().setItem(CACHE_KEY, JSON.stringify(cache));
}

function normalizeKey(name) {
  return name.trim().toLowerCase();
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function checkNutritionProxyHealth() {
  try {
    return await fetchJson("/api/nutrition/health");
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Resolves one ingredient name to a cached (or freshly fetched) per-100g
// nutrient profile. Returns null if USDA has no reasonable match at all.
export async function resolveIngredient(name, { forceRefresh = false } = {}) {
  const key = normalizeKey(name);
  const cache = readCache();
  const cached = cache[key];
  if (!forceRefresh && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const search = await fetchJson(`/api/nutrition/search?q=${encodeURIComponent(name)}`);
  if (!search.bestMatchFdcId) {
    return null;
  }
  const detail = await fetchJson(`/api/nutrition/food/${search.bestMatchFdcId}`);

  const resolved = {
    fdcId: detail.fdcId,
    description: detail.description,
    dataType: detail.dataType,
    per100g: detail.per100g,
    cachedAt: Date.now(),
  };
  cache[key] = resolved;
  writeCache(cache);
  return resolved;
}

function addScaled(totals, per100g, grams) {
  const scale = grams / 100;
  for (const [key, value] of Object.entries(per100g || {})) {
    if (typeof value !== "number") continue;
    totals[key] = (totals[key] || 0) + value * scale;
  }
}

function round(totals) {
  const out = {};
  for (const [key, value] of Object.entries(totals)) {
    out[key] = Math.round(value * 10) / 10;
  }
  return out;
}

// Looks up nutrition for every ingredient in a food and sums the scaled
// results into one per-serving estimate. This is what makes a composite
// dish like "Paneer paratha + dahi" work at all - the dish name itself
// won't match a nutrition database, but its ingredients will.
export async function fetchNutritionForFood(food, { forceRefresh = false } = {}) {
  if (!food.ingredients || !food.ingredients.length) {
    return { perServing: {}, matchedIngredients: [], unmatched: [], fetchedAt: new Date().toISOString() };
  }

  const totals = {};
  const matchedIngredients = [];
  const unmatched = [];

  for (const ingredient of food.ingredients) {
    let resolved;
    try {
      resolved = await resolveIngredient(ingredient.name, { forceRefresh });
    } catch (err) {
      unmatched.push(`${ingredient.name} (${err.message})`);
      continue;
    }
    if (!resolved) {
      unmatched.push(ingredient.name);
      continue;
    }
    addScaled(totals, resolved.per100g, ingredient.grams);
    matchedIngredients.push({
      inputName: ingredient.name,
      grams: ingredient.grams,
      matchedDescription: resolved.description,
      fdcId: resolved.fdcId,
    });
  }

  return {
    perServing: round(totals),
    matchedIngredients,
    unmatched,
    fetchedAt: new Date().toISOString(),
  };
}

// Runs fetchNutritionForFood across every food in a profile, in sequence
// (not in parallel) so a "refresh all" pass doesn't fire dozens of requests
// at once and trip the USDA rate limit. onProgress is called after each food.
export async function refreshAllNutrition(foods, { forceRefresh = false, onProgress } = {}) {
  const results = {};
  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    try {
      results[food.id] = await fetchNutritionForFood(food, { forceRefresh });
    } catch (err) {
      results[food.id] = { perServing: {}, matchedIngredients: [], unmatched: [`Lookup failed: ${err.message}`], fetchedAt: new Date().toISOString() };
    }
    if (onProgress) onProgress(i + 1, foods.length, food);
  }
  return results;
}
