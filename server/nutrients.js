// Pure nutrient-normalization helpers, kept separate from server/index.js
// (which has the side effect of starting an HTTP listener on import) so
// this logic can be unit-tested in isolation.

// FDC's nutrient names are verbose and vary slightly by dataset; match
// loosely rather than on an exact string.
const NUTRIENT_MATCHERS = [
  { key: "calories", test: (n) => n.includes("energy") && !n.includes("kj") },
  { key: "protein_g", test: (n) => n === "protein" },
  { key: "fat_g", test: (n) => n.includes("total lipid") },
  { key: "carbs_g", test: (n) => n.includes("carbohydrate") },
  { key: "fiber_g", test: (n) => n.includes("fiber") },
  { key: "iron_mg", test: (n) => n.includes("iron") },
  { key: "calcium_mg", test: (n) => n.includes("calcium") },
  { key: "vitaminC_mg", test: (n) => n.includes("vitamin c") },
];

// Normalizes an FDC food-detail payload to per-100g macro/micro values.
export function normalizeNutrients(foodDetail) {
  const out = {};
  const nutrients = foodDetail.foodNutrients || [];
  for (const entry of nutrients) {
    const name = (entry.nutrient?.name || entry.nutrientName || "").toLowerCase();
    const amount = entry.amount ?? entry.value ?? null;
    if (amount == null) continue;
    for (const matcher of NUTRIENT_MATCHERS) {
      if (out[matcher.key] == null && matcher.test(name)) {
        out[matcher.key] = amount;
      }
    }
  }
  return out;
}

// Prefer generic reference data (Foundation / SR Legacy) over branded
// products or survey entries, so "banana" doesn't resolve to a branded
// banana-flavored snack.
export function pickBestMatch(foods) {
  return (
    foods.find((f) => f.dataType === "Foundation") ||
    foods.find((f) => f.dataType === "SR Legacy") ||
    foods[0] ||
    null
  );
}
