// Core rules engine for the meal planner. Pure functions only (no React,
// no DOM) so they can be unit-tested directly with Node and reused for any
// toddler profile, not just one hardcoded child.

export const DEFAULT_MEAL_SLOTS = ["Breakfast", "Mid-Morning", "Lunch", "Evening Snack", "Dinner"];
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const FOOD_CATEGORIES = ["protein", "carb", "fruit", "veg", "dairy", "mixed", "snack"];

// Adventurousness is a friendly label over two underlying knobs:
// - exposureTargetPerWeek: how many meal slots per week are used to keep
//   offering non-safe foods (research suggests ~10-15 tries before a
//   toddler accepts something new, so this should stay steady, not spike).
// - repeatGapDays: minimum days before the same safe food is favored again,
//   which is what actually produces week-to-week variety.
export const ADVENTUROUSNESS_PRESETS = {
  gentle: { exposureTargetPerWeek: 2, repeatGapDays: 4 },
  balanced: { exposureTargetPerWeek: 4, repeatGapDays: 3 },
  adventurous: { exposureTargetPerWeek: 6, repeatGapDays: 2 },
};

export function createFood({
  name,
  category,
  suitableSlots,
  tags = [],
  status = "safe", // "safe" | "exposure" | "retired" (retired is the ONLY manual/explicit removal path)
  addNote = "",
  exposureGoal = "",
  // Core ingredients this dish is made from, e.g. [{ name: "banana, raw", grams: 60 }].
  // A composite dish name like "Paneer paratha + dahi" won't match a nutrition
  // database on its own - looking up each ingredient and summing the scaled
  // amounts is what makes real nutrition data possible for home-cooked meals.
  ingredients = [],
  // Cached result of the last USDA lookup: { perServing: {...}, matchedIngredients: [...], fetchedAt }.
  // Populated by nutritionApi.js, not authored by hand.
  nutrition = null,
}) {
  return {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    category,
    suitableSlots,
    tags,
    status,
    addNote,
    exposureGoal,
    ingredients,
    nutrition,
    timesOffered: 0,
    timesAccepted: 0,
    timesPartial: 0,
    timesRejected: 0,
  };
}

export function createDefaultSettings(adventurousness = "balanced") {
  return { adventurousness, ...ADVENTUROUSNESS_PRESETS[adventurousness] };
}

// Deterministic seeded RNG (mulberry32) so the generated plan is stable
// across re-renders for the same data, but changes when foods/settings/log
// actually change - no need for extra React state to "freeze" a plan.
function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rand = function rand() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // Similar seed strings (e.g. "Monday" vs "Tuesday") can produce correlated
  // first outputs from a single-pass hash. Warming up a couple of rounds
  // decorrelates them so nearby days/slots don't keep landing on the same
  // weighted bucket.
  rand();
  rand();
  return rand;
}

// Laplace-smoothed acceptance ratio. This can shrink toward zero but never
// hit it, so a repeatedly-refused food fades in frequency rather than being
// dropped - it can still be picked, just less often.
function acceptanceWeight(food) {
  return (food.timesAccepted * 2 + food.timesPartial + 1) / (food.timesOffered + 2);
}

function weightedPick(candidates, weightFn, rand) {
  const weights = candidates.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return candidates[0];
  let r = rand() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// Spread N exposure slots evenly across the week, biased toward Lunch/Dinner
// where a new food is easiest to plate alongside a safe favorite.
function pickExposureCells(days, mealSlots, count) {
  if (count <= 0) return [];
  const preferredSlots = mealSlots.filter((s) => s === "Lunch" || s === "Dinner");
  const fallbackSlots = mealSlots.filter((s) => s !== "Lunch" && s !== "Dinner");

  const buildCells = (slots) => {
    const cells = [];
    slots.forEach((slot) => days.forEach((day) => cells.push({ day, slot })));
    return cells;
  };

  const preferredCells = buildCells(preferredSlots.length ? preferredSlots : mealSlots);
  const pool = count <= preferredCells.length ? preferredCells : buildCells([...preferredSlots, ...fallbackSlots]);

  // Evenly space `count` picks across the pool so both available slot types
  // and different days actually get used, instead of clustering.
  const step = pool.length / count;
  const cells = [];
  for (let i = 0; i < count; i++) {
    cells.push(pool[Math.floor(i * step) % pool.length]);
  }
  return cells;
}

// Generates one week of meals for a profile. This replaces a single static
// template: it is recomputed from the food pool + settings + history every
// time, so editing one meal no longer freezes that slot forever, and no
// food is ever silently dropped from being offered.
export function generateWeekPlan(profile) {
  const mealSlots = profile.mealSlots && profile.mealSlots.length ? profile.mealSlots : DEFAULT_MEAL_SLOTS;
  const days = DAYS;
  const active = profile.foods.filter((f) => f.status !== "retired");
  const exposureFoods = active.filter((f) => f.status === "exposure");
  const safeFoods = active.filter((f) => f.status === "safe");
  const exposureCells = pickExposureCells(days, mealSlots, profile.settings.exposureTargetPerWeek);

  const plan = {};
  const recentUse = {};

  days.forEach((day, dayIdx) => {
    plan[day] = {};
    mealSlots.forEach((slot, slotIdx) => {
      const rand = seededRandom(`${profile.id}|${dayIdx}|${slotIdx}|${active.length}`);
      const exposureCell = exposureCells.find((c) => c.day === day && c.slot === slot);

      let chosen = null;
      let isExposure = false;

      if (exposureCell) {
        const eligible = exposureFoods.filter((f) => f.suitableSlots.includes(slot));
        if (eligible.length) {
          // Prioritize the least-tried exposure food(s) - this is what keeps
          // rotating *which* new food is being worked on toward the 10-15x
          // guidance instead of spiking one food then abandoning it. When
          // several are equally under-tried, pick among them with the
          // seeded rand so the week doesn't always surface the same one.
          const minOffered = Math.min(...eligible.map((f) => f.timesOffered));
          const leastTried = eligible.filter((f) => f.timesOffered === minOffered);
          chosen = leastTried[Math.floor(rand() * leastTried.length)];
          isExposure = true;
        }
      }

      if (!chosen) {
        let eligible = safeFoods.filter((f) => f.suitableSlots.includes(slot));
        if (!eligible.length) eligible = active.filter((f) => f.suitableSlots.includes(slot));
        if (!eligible.length) eligible = active;
        if (eligible.length) {
          chosen = weightedPick(
            eligible,
            (f) => {
              const w = acceptanceWeight(f);
              const lastUsed = recentUse[f.id];
              const withinGap = lastUsed !== undefined && dayIdx - lastUsed < profile.settings.repeatGapDays;
              return withinGap ? w * 0.15 : w;
            },
            rand
          );
        }
      }

      if (!chosen) {
        plan[day][slot] = { foodId: null, meal: "Add foods for this slot", add: "No foods are set up for this meal slot yet.", isExposure: false };
        return;
      }

      recentUse[chosen.id] = dayIdx;

      plan[day][slot] = {
        foodId: chosen.id,
        meal: chosen.name,
        add: isExposure && chosen.exposureGoal ? chosen.exposureGoal : chosen.addNote || "Pair with a safe favorite and a fruit or dairy side for balance.",
        isExposure,
        exposureProgress: isExposure ? `Offered ${chosen.timesOffered}x so far (toddlers often need 10-15 tries)` : null,
        category: chosen.category,
        tags: chosen.tags,
      };
    });
  });

  return plan;
}

// Logs a parent's observation against a food. Never deletes or excludes a
// food based on this - "retired" is a separate, explicit, manual action.
export function logResponse(profile, { day, slot, foodId, response, note = "" }) {
  let justGraduated = false;
  const foods = profile.foods.map((f) => {
    if (f.id !== foodId) return f;
    const updated = { ...f, timesOffered: f.timesOffered + 1 };
    if (response === "accepted") updated.timesAccepted += 1;
    else if (response === "partial") updated.timesPartial += 1;
    else if (response === "refused") updated.timesRejected += 1;

    // Graduation only ever moves a food toward "safe" - it's encouragement
    // for progress, never a penalty in the other direction.
    if (updated.status === "exposure" && updated.timesAccepted >= 3 && updated.timesAccepted / updated.timesOffered >= 0.5) {
      updated.status = "safe";
      justGraduated = true;
    }
    return updated;
  });

  const log = [
    ...profile.log,
    { id: Date.now() + Math.random(), day, slot, foodId, response, note, justGraduated, at: new Date().toISOString() },
  ];

  return { ...profile, foods, log };
}

// Records a general observation - e.g. "he's been picky about breakfast all
// week" - without treating it as a specific "we served this and here's what
// happened" event. Unlike logResponse, this never touches a food's
// offered/accepted/rejected counters, since no single meal is being
// reported on. foodId is optional (null for a note not tied to one food).
export function addParentNote(profile, { foodId = null, note }) {
  const log = [
    ...profile.log,
    { id: Date.now() + Math.random(), day: null, slot: null, foodId, response: "note", note, justGraduated: false, at: new Date().toISOString() },
  ];
  return { ...profile, log };
}

export function getTip(profile) {
  const { log, foods } = profile;
  if (!log.length) {
    return "Offer a mix of safe foods and one small new-food exposure. Toddlers often need 10-15 tries before accepting something new - repetition without pressure is the goal, and nothing gets removed from rotation just for being refused.";
  }
  const last = log[log.length - 1];
  const food = foods.find((f) => f.id === last.foodId);
  if (!food) return "Keep offering variety alongside safe favorites.";

  if (last.response === "refused") {
    return `"${food.name}" was refused this time (offered ${food.timesOffered}x so far) - that's expected. Keep it in rotation occasionally alongside safe foods; most toddlers need 10-15 tries before accepting something new.`;
  }
  if (last.response === "accepted") {
    if (last.justGraduated) return `🎉 "${food.name}" has graduated to a safe food after consistent acceptance!`;
    return food.status === "safe"
      ? `"${food.name}" continues to be accepted - nice and steady.`
      : `"${food.name}" was accepted! A few more consistent yeses and it'll graduate to a safe food.`;
  }
  if (last.response === "partial") {
    return `Good progress - "${food.name}" was touched/tried a little. That counts as a real exposure toward the 10-15 tries.`;
  }
  return "Balance today's plate with a protein, a fruit or veg, and a familiar carb.";
}
