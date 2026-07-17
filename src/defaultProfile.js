import { createDefaultSettings, DEFAULT_MEAL_SLOTS } from "./foodEngine";
import { createFood } from "./foodEngine";

// A brand new profile for a toddler you haven't set up yet - no foods
// pre-loaded, so nothing about their plan is inherited from the example.
export function createBlankProfile(name) {
  return {
    id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    mealSlots: DEFAULT_MEAL_SLOTS,
    settings: createDefaultSettings("balanced"),
    foods: [],
    log: [],
  };
}

// Ingredient names below are written as plain search terms for the USDA
// FoodData Central search endpoint (see server/index.js + src/nutritionApi.js),
// not exact database keys - the app resolves each one to a real FDC match
// (preferring generic Foundation/SR Legacy entries) when you look up or
// refresh nutrition. Grams are rough toddler-serving estimates, meant as a
// starting point you can correct once real data comes back, not a precise
// recipe. A few home-style ingredients (paneer, ragi, lauki) don't have an
// exact USDA entry, so the closest generic stand-in is used (cottage
// cheese for paneer, millet for ragi, summer squash for lauki) - worth
// keeping in mind when reading the numbers.

// This is just a starter example profile (rename or delete it freely from
// the Profiles menu) so the app isn't empty on first load. Every field here
// is editable per toddler from the Foods and Settings tabs - nothing about
// this app is hardcoded to one child.
export function createExampleProfile(name = "Kabir") {
  const safe = [
    { name: "Apple pancake", category: "carb", suitableSlots: ["Breakfast"], addNote: "Add nut powder + chia/flax powder + little banana mash.", ingredients: [{ name: "wheat flour, whole-grain", grams: 30 }, { name: "egg, whole, raw", grams: 25 }, { name: "milk, whole", grams: 30 }, { name: "apple, raw", grams: 30 }, { name: "ghee", grams: 5 }] },
    { name: "Idli + ghee", category: "carb", suitableSlots: ["Breakfast"], addNote: "Add ghee on idli; keep curd plain.", ingredients: [{ name: "rice, white, cooked", grams: 60 }, { name: "lentils, mature seeds, cooked", grams: 15 }, { name: "ghee", grams: 5 }] },
    { name: "Besan paneer cheela", category: "protein", suitableSlots: ["Breakfast", "Lunch"], addNote: "Add spinach puree very lightly so color change is mild.", ingredients: [{ name: "chickpea flour", grams: 35 }, { name: "cheese, cottage", grams: 30 }, { name: "spinach, raw", grams: 10 }] },
    { name: "Ragi banana pancake", category: "carb", suitableSlots: ["Breakfast"], addNote: "Add nut powder + dates powder for iron and energy.", tags: ["iron"], ingredients: [{ name: "millet flour", grams: 30 }, { name: "banana, raw", grams: 40 }, { name: "milk, whole", grams: 30 }] },
    { name: "French toast", category: "mixed", suitableSlots: ["Breakfast", "Evening Snack"], addNote: "Cook in ghee. Add mashed banana or cinnamon if accepted.", ingredients: [{ name: "bread, whole wheat", grams: 30 }, { name: "egg, whole, raw", grams: 25 }, { name: "milk, whole", grams: 20 }, { name: "ghee", grams: 5 }] },
    { name: "Suji pancake / dosa", category: "carb", suitableSlots: ["Breakfast"], addNote: "Add curd in batter + nut powder if taste allows.", ingredients: [{ name: "farina", grams: 30 }, { name: "yogurt, plain, whole milk", grams: 15 }] },
    { name: "Watermelon", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Good hydration.", ingredients: [{ name: "watermelon, raw", grams: 100 }] },
    { name: "Papaya", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Serve chilled in small cubes.", ingredients: [{ name: "papaya, raw", grams: 80 }] },
    { name: "Mango", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Serve chilled.", ingredients: [{ name: "mango, raw", grams: 80 }] },
    { name: "Apple", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Offer with thin curd dip if accepted.", ingredients: [{ name: "apple, raw", grams: 80 }] },
    { name: "Paneer paratha + dahi", category: "mixed", suitableSlots: ["Lunch"], addNote: "Add spinach in dough and sesame powder in dahi.", ingredients: [{ name: "wheat flour, whole-grain", grams: 40 }, { name: "cheese, cottage", grams: 30 }, { name: "yogurt, plain, whole milk", grams: 40 }, { name: "ghee", grams: 5 }] },
    { name: "White rice + ghee + curd", category: "carb", suitableSlots: ["Lunch", "Dinner"], addNote: "Keep rice white. Use only ghee/jeera/curd. Keep dal/sabji separately nearby.", ingredients: [{ name: "rice, white, cooked", grams: 100 }, { name: "ghee", grams: 5 }, { name: "yogurt, plain, whole milk", grams: 40 }] },
    { name: "Aloo sandwich", category: "carb", suitableSlots: ["Lunch"], addNote: "Add cheese. Keep texture simple and predictable.", ingredients: [{ name: "bread, white", grams: 30 }, { name: "potato, boiled", grams: 60 }, { name: "cheese, cheddar", grams: 15 }] },
    { name: "Avocado toast", category: "mixed", suitableSlots: ["Evening Snack"], addNote: "Add a very thin cheese or paneer spread if accepted.", ingredients: [{ name: "bread, whole wheat", grams: 30 }, { name: "avocado, raw", grams: 40 }, { name: "cheese, cheddar", grams: 10 }] },
    { name: "Curd + crushed banana", category: "dairy", suitableSlots: ["Evening Snack"], addNote: "Add roasted nut powder or dates powder.", ingredients: [{ name: "yogurt, plain, whole milk", grams: 80 }, { name: "banana, raw", grams: 40 }] },
    { name: "Cheese toast fingers", category: "snack", suitableSlots: ["Evening Snack"], addNote: "Use whole wheat bread if accepted.", ingredients: [{ name: "bread, whole wheat", grams: 30 }, { name: "cheese, cheddar", grams: 15 }] },
    { name: "Boiled potato with butter/ghee", category: "carb", suitableSlots: ["Evening Snack"], addNote: "Sprinkle sesame powder if accepted.", ingredients: [{ name: "potato, boiled", grams: 80 }, { name: "ghee", grams: 5 }] },
    { name: "Banana peanut butter mini sandwich", category: "snack", suitableSlots: ["Evening Snack"], addNote: "Use thin peanut butter layer. Avoid chunks.", ingredients: [{ name: "bread, white", grams: 25 }, { name: "banana, raw", grams: 30 }, { name: "peanut butter", grams: 10 }] },
    { name: "Cold khichdi fingers", category: "mixed", suitableSlots: ["Dinner"], addNote: "Use moong dal + tiny grated carrot hidden.", tags: ["hidden-veg"], ingredients: [{ name: "rice, white, cooked", grams: 50 }, { name: "lentils, mature seeds, cooked", grams: 20 }, { name: "carrot, raw", grams: 10 }, { name: "ghee", grams: 5 }] },
    { name: "Pasta with hidden paneer sauce", category: "mixed", suitableSlots: ["Dinner"], addNote: "Blend paneer + milk + pumpkin/carrot + butter.", tags: ["hidden-veg"], ingredients: [{ name: "pasta, cooked", grams: 60 }, { name: "cheese, cottage", grams: 30 }, { name: "milk, whole", grams: 20 }, { name: "pumpkin, raw", grams: 15 }, { name: "butter", grams: 5 }] },
    { name: "Ghee roti + dahi", category: "carb", suitableSlots: ["Dinner"], addNote: "Keep cucumber/onion on side as no-pressure exposure.", ingredients: [{ name: "wheat flour, whole-grain", grams: 40 }, { name: "ghee", grams: 5 }, { name: "yogurt, plain, whole milk", grams: 40 }] },
    { name: "Macroni with hidden veggie sauce", category: "mixed", suitableSlots: ["Dinner"], addNote: "Paneer + pumpkin/carrot puree + butter/ghee.", tags: ["hidden-veg"], ingredients: [{ name: "pasta, cooked", grams: 60 }, { name: "cheese, cottage", grams: 25 }, { name: "pumpkin, raw", grams: 15 }, { name: "butter", grams: 5 }] },
    { name: "Egg bhurji", category: "protein", suitableSlots: ["Breakfast"], addNote: "Scramble soft in butter/ghee; keep spices very mild.", ingredients: [{ name: "egg, whole, raw", grams: 50 }, { name: "butter", grams: 5 }] },
    { name: "Vegetable upma", category: "carb", suitableSlots: ["Breakfast"], addNote: "Semolina cooked soft with finely diced carrot/peas and a little ghee.", tags: ["hidden-veg"], ingredients: [{ name: "farina", grams: 40 }, { name: "carrot, raw", grams: 15 }, { name: "peas, green, boiled", grams: 10 }, { name: "ghee", grams: 5 }] },
    { name: "Moong sprouts poha", category: "mixed", suitableSlots: ["Breakfast"], addNote: "Flattened rice cooked soft with mashed moong sprouts and a little turmeric/ghee.", ingredients: [{ name: "rice, white, cooked", grams: 50 }, { name: "mung beans, sprouted, raw", grams: 20 }, { name: "ghee", grams: 5 }] },
    { name: "Moong dal cheela with veggies", category: "protein", suitableSlots: ["Breakfast", "Lunch"], addNote: "Blend soaked moong dal into a batter; add finely grated carrot/spinach.", tags: ["hidden-veg"], ingredients: [{ name: "lentils, mature seeds, cooked", grams: 40 }, { name: "carrot, raw", grams: 10 }, { name: "ghee", grams: 5 }] },
    { name: "Chana masala (mild)", category: "protein", suitableSlots: ["Lunch", "Dinner"], addNote: "Cook chickpeas very soft in a mild tomato base; mash a few for easier eating.", ingredients: [{ name: "chickpeas, mature seeds, cooked", grams: 60 }, { name: "tomato, raw", grams: 20 }, { name: "ghee", grams: 5 }] },
    { name: "Grilled chicken strips (mild)", category: "protein", suitableSlots: ["Lunch", "Dinner"], addNote: "Yogurt-marinated, well-cooked, cut into soft thin strips (not chunks).", ingredients: [{ name: "chicken, breast, cooked", grams: 50 }, { name: "yogurt, plain, whole milk", grams: 15 }] },
    { name: "Baked fish fingers (boneless)", category: "protein", suitableSlots: ["Dinner"], addNote: "Use boneless fillet only; double-check for bones. Bake, don't fry.", ingredients: [{ name: "fish, cooked, dry heat", grams: 50 }, { name: "bread crumbs", grams: 15 }] },
    { name: "Paneer tikka (mild, soft)", category: "protein", suitableSlots: ["Lunch", "Dinner"], addNote: "Yogurt marinade, mild spices only, pan-soft rather than char-grilled firm.", ingredients: [{ name: "cheese, cottage", grams: 50 }, { name: "yogurt, plain, whole milk", grams: 15 }] },
    { name: "Quinoa veggie pulao", category: "carb", suitableSlots: ["Lunch"], addNote: "Cook quinoa very soft with finely diced carrot and peas.", tags: ["hidden-veg"], ingredients: [{ name: "quinoa, cooked", grams: 60 }, { name: "carrot, raw", grams: 10 }, { name: "peas, green, boiled", grams: 10 }, { name: "ghee", grams: 5 }] },
    { name: "Multigrain roti + sabzi", category: "mixed", suitableSlots: ["Dinner"], addNote: "Soft multigrain roti with a mild, well-mashed mixed vegetable side.", ingredients: [{ name: "wheat flour, whole-grain", grams: 40 }, { name: "carrot, raw", grams: 15 }, { name: "ghee", grams: 5 }] },
    { name: "Broccoli cheese bites", category: "veg", suitableSlots: ["Evening Snack"], addNote: "Steam broccoli very soft, chop fine, mix with cheese and a little breadcrumb, bake soft (not crunchy/hard).", ingredients: [{ name: "broccoli, cooked", grams: 40 }, { name: "cheese, cheddar", grams: 15 }] },
    { name: "Roasted sweet potato fries (soft)", category: "veg", suitableSlots: ["Evening Snack", "Dinner"], addNote: "Cut into soft finger shapes, roast until fully soft, not crisp/hard.", ingredients: [{ name: "sweet potato, cooked", grams: 70 }, { name: "olive oil", grams: 5 }] },
    { name: "Fruit and yogurt smoothie", category: "dairy", suitableSlots: ["Mid-Morning"], addNote: "Blend smooth - no chunks. Good vehicle for a new fruit alongside a safe one.", ingredients: [{ name: "yogurt, plain, whole milk", grams: 80 }, { name: "banana, raw", grams: 40 }, { name: "mango, raw", grams: 30 }] },
    { name: "Date & oat soft bites", category: "snack", suitableSlots: ["Evening Snack"], addNote: "Blend soft pitted dates + oats + ghee into a soft dough; no whole nuts. Press flat, don't roll into hard balls (choking risk).", ingredients: [{ name: "dates, deglet noor", grams: 20 }, { name: "oats, raw", grams: 20 }, { name: "ghee", grams: 5 }] },
  ];

  const exposure = [
    { name: "Carrot stick", category: "veg", suitableSlots: ["Lunch"], exposureGoal: "Steam briefly to soften or cut into a thin matchstick (not a firm raw chunk/coin) - raw hard carrot is a choking hazard at this age. Only touch, smell, lick, or keep on plate. Eating is optional, and supervise closely.", ingredients: [{ name: "carrot, raw", grams: 10 }] },
    { name: "Boiled pea", category: "veg", suitableSlots: ["Lunch", "Dinner"], exposureGoal: "Keep it separate, not mixed in. Let them decide whether to touch it.", ingredients: [{ name: "peas, green, boiled", grams: 10 }] },
    { name: "Dal (separate spoon)", category: "protein", suitableSlots: ["Lunch", "Dinner"], exposureGoal: "Do not mix with rice. Just keep nearby without pressure.", ingredients: [{ name: "lentils, mature seeds, cooked", grams: 15 }] },
    { name: "Lauki/pumpkin cube", category: "veg", suitableSlots: ["Lunch", "Dinner"], exposureGoal: "No pressure. Parent can eat it casually in front of them.", ingredients: [{ name: "squash, summer, cooked", grams: 15 }] },
    { name: "Broccoli floret (steamed soft)", category: "veg", suitableSlots: ["Lunch", "Dinner"], exposureGoal: "Steam until very soft (not firm/crunchy). Keep separate on the plate; touching/licking counts as a win.", ingredients: [{ name: "broccoli, cooked", grams: 10 }] },
    { name: "Bell pepper strip (cooked, thin)", category: "veg", suitableSlots: ["Lunch", "Dinner"], exposureGoal: "Cook until soft, cut into a thin strip, not a raw firm chunk. No pressure to eat.", ingredients: [{ name: "peppers, sweet, cooked", grams: 10 }] },
    { name: "Green beans (steamed soft)", category: "veg", suitableSlots: ["Lunch", "Dinner"], exposureGoal: "Steam until very soft and easily squashed between fingers before offering.", ingredients: [{ name: "green beans, cooked", grams: 10 }] },
  ];

  return {
    id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    mealSlots: DEFAULT_MEAL_SLOTS,
    settings: createDefaultSettings("balanced"),
    foods: [
      ...safe.map((f) => createFood({ ...f, status: "safe" })),
      ...exposure.map((f) => createFood({ ...f, status: "exposure" })),
    ],
    log: [],
  };
}

// Starter profile for a baby beginning solids (~6 months). Deliberately a
// separate profile from the toddler example above, not more foods bolted
// onto it - a 6-month-old needs smooth single-ingredient purees, not
// parathas or finger foods, so mixing the two pools would make the rotation
// engine offer age-inappropriate meals.
export function createInfantStarterProfile(name = "Little one") {
  const purees = [
    { name: "Mashed banana", category: "fruit", suitableSlots: ["Breakfast", "Mid-Morning"], addNote: "Ripe banana, mashed smooth with a fork. No cooking needed.", ingredients: [{ name: "banana, raw", grams: 60 }] },
    { name: "Mashed avocado", category: "fruit", suitableSlots: ["Breakfast", "Lunch"], addNote: "Naturally creamy - mash smooth, no salt.", ingredients: [{ name: "avocado, raw", grams: 50 }] },
    { name: "Stewed & mashed apple", category: "fruit", suitableSlots: ["Mid-Morning", "Evening Snack"], addNote: "Steam or stew until soft, then mash smooth - raw apple is a choking risk at this age.", ingredients: [{ name: "apple, raw", grams: 60 }] },
    { name: "Stewed & mashed pear", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Cook until soft, then mash smooth.", ingredients: [{ name: "pear, raw", grams: 60 }] },
    { name: "Mashed papaya", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Use ripe, soft papaya; mash well and remove seeds.", ingredients: [{ name: "papaya, raw", grams: 60 }] },
    { name: "Mashed mango", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Ripe pulp, mashed smooth.", ingredients: [{ name: "mango, raw", grams: 60 }] },
    { name: "Mashed chikoo (sapodilla)", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Ripe and soft; mash well. Naturally sweet.", ingredients: [{ name: "sapodilla, raw", grams: 60 }] },
    { name: "Mashed sweet potato", category: "veg", suitableSlots: ["Lunch", "Dinner"], addNote: "Steam or boil until very soft, mash smooth. An easy, mild first vegetable.", ingredients: [{ name: "sweet potato, cooked", grams: 60 }] },
    { name: "Mashed pumpkin", category: "veg", suitableSlots: ["Lunch", "Dinner"], addNote: "Steam until soft, mash smooth.", ingredients: [{ name: "pumpkin, raw", grams: 60 }] },
    { name: "Mashed carrot", category: "veg", suitableSlots: ["Lunch", "Dinner"], addNote: "Steam until very soft before mashing - raw or firm carrot is a choking hazard.", ingredients: [{ name: "carrot, cooked", grams: 60 }] },
    { name: "Mashed green peas", category: "veg", suitableSlots: ["Lunch", "Dinner"], addNote: "Boil until soft, mash and press through a sieve to remove the skins.", ingredients: [{ name: "peas, green, boiled", grams: 50 }] },
    { name: "Mashed potato", category: "carb", suitableSlots: ["Lunch", "Dinner"], addNote: "Boil and mash smooth; thin with a little breastmilk/formula if needed.", ingredients: [{ name: "potato, boiled", grams: 60 }] },
    { name: "Mashed bottle gourd (lauki)", category: "veg", suitableSlots: ["Lunch", "Dinner"], addNote: "Steam until soft, mash completely smooth.", ingredients: [{ name: "squash, summer, cooked", grams: 60 }] },
    { name: "Ragi porridge", category: "carb", suitableSlots: ["Breakfast"], addNote: "Cook ragi flour with water/milk until thin and smooth. A good iron and calcium source.", tags: ["iron"], ingredients: [{ name: "millet flour", grams: 20 }, { name: "milk, whole", grams: 60 }] },
    { name: "Rice porridge (thin)", category: "carb", suitableSlots: ["Breakfast", "Lunch"], addNote: "Cook rice very soft with extra water, then mash or blend smooth.", ingredients: [{ name: "rice, white, cooked", grams: 40 }, { name: "milk, whole", grams: 40 }] },
    { name: "Oats porridge (thin)", category: "carb", suitableSlots: ["Breakfast"], addNote: "Cook oats soft with water/milk, blend smooth for first tries.", ingredients: [{ name: "oats, raw", grams: 20 }, { name: "milk, whole", grams: 60 }] },
    { name: "Moong dal khichdi (well mashed)", category: "mixed", suitableSlots: ["Lunch", "Dinner"], addNote: "Cook rice + moong dal until very soft, then mash completely smooth.", ingredients: [{ name: "rice, white, cooked", grams: 30 }, { name: "lentils, mature seeds, cooked", grams: 20 }] },
    { name: "Moong dal puree", category: "protein", suitableSlots: ["Lunch", "Dinner"], addNote: "Cook dal soft, mash, and thin with its own cooking water.", ingredients: [{ name: "lentils, mature seeds, cooked", grams: 40 }] },
    { name: "Masoor dal puree", category: "protein", suitableSlots: ["Lunch", "Dinner"], addNote: "Cook until soft, mash smooth.", ingredients: [{ name: "lentils, mature seeds, cooked", grams: 40 }] },
    { name: "Mashed spinach dal", category: "mixed", suitableSlots: ["Dinner"], addNote: "Cook a little spinach into thin dal, then blend completely smooth.", ingredients: [{ name: "lentils, mature seeds, cooked", grams: 30 }, { name: "spinach, cooked", grams: 15 }] },
    { name: "Mashed guava", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Use ripe guava; cook briefly if firm, then mash and pass through a sieve to remove seeds.", ingredients: [{ name: "guava, raw", grams: 60 }] },
    { name: "Stewed plum puree", category: "fruit", suitableSlots: ["Mid-Morning"], addNote: "Stew until soft, remove skin/pit, blend smooth.", ingredients: [{ name: "plums, raw", grams: 60 }] },
    { name: "Mashed beetroot", category: "veg", suitableSlots: ["Lunch", "Dinner"], addNote: "Steam or boil until very soft, mash or blend smooth. Naturally sweet, mild first vegetable.", ingredients: [{ name: "beets, cooked", grams: 50 }] },
    { name: "Mashed cauliflower", category: "veg", suitableSlots: ["Lunch", "Dinner"], addNote: "Steam until very soft, mash or blend smooth.", ingredients: [{ name: "cauliflower, cooked", grams: 60 }] },
    { name: "Moong sprouts puree", category: "protein", suitableSlots: ["Lunch", "Dinner"], addNote: "Cook sprouted moong until very soft, blend completely smooth.", ingredients: [{ name: "mung beans, sprouted, cooked", grams: 40 }] },
    { name: "Mashed egg yolk", category: "protein", suitableSlots: ["Breakfast"], addNote: "Hard-boil, use only the fully cooked yolk mashed with a little breastmilk/formula. Introduce on its own first and watch for any reaction; check with your pediatrician first if there's a family history of egg allergy or eczema.", ingredients: [{ name: "egg, yolk, cooked", grams: 20 }] },
    { name: "Ragi apple porridge", category: "mixed", suitableSlots: ["Breakfast"], addNote: "Cook ragi flour thin and smooth, stir in stewed mashed apple.", tags: ["iron"], ingredients: [{ name: "millet flour", grams: 20 }, { name: "apple, raw", grams: 30 }, { name: "milk, whole", grams: 30 }] },
    { name: "Oats banana porridge", category: "carb", suitableSlots: ["Breakfast"], addNote: "Cook oats soft with milk, blend in mashed banana.", ingredients: [{ name: "oats, raw", grams: 20 }, { name: "banana, raw", grams: 40 }, { name: "milk, whole", grams: 40 }] },
    { name: "Plain whole-milk yogurt", category: "dairy", suitableSlots: ["Lunch"], addNote: "Plain, unsweetened, full-fat yogurt in small spoonfuls - different from cow's milk as a drink, which should wait until 12 months. Check timing with your pediatrician if unsure.", ingredients: [{ name: "yogurt, plain, whole milk", grams: 50 }] },
    { name: "Quinoa porridge (thin)", category: "carb", suitableSlots: ["Breakfast", "Lunch"], addNote: "Cook quinoa very soft with extra water/milk, blend smooth.", ingredients: [{ name: "quinoa, cooked", grams: 40 }, { name: "milk, whole", grams: 30 }] },
  ];

  return {
    id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    mealSlots: DEFAULT_MEAL_SLOTS,
    settings: createDefaultSettings("gentle"),
    foods: purees.map((f) => createFood({ ...f, status: "safe" })),
    log: [],
  };
}

export const recipes = [
  { name: "Paneer Pasta", why: "Pasta is already an easy nutrition carrier for many toddlers.", cheese: "Use a cheese cube or skip it - paneer is the main protein here.", steps: "Blend paneer + milk + tiny boiled pumpkin/carrot + butter. Mix with pasta. Keep sauce light in color." },
  { name: "Cheese Corn Paratha", why: "Similar to paneer paratha - mild and familiar.", cheese: "Use a cheese slice or grated mozzarella. Avoid too much processed cheese daily.", steps: "Mash boiled corn + potato + cheese. Stuff lightly in paratha. Serve with curd." },
  { name: "Curd Rice Balls", why: "Uses common safe foods: white rice, curd, ghee, in a finger-food format.", cheese: "No cheese needed.", steps: "Mix cold rice + curd + ghee. Make small balls. Keep them plain; avoid mixing in colored dal/sabji." },
  { name: "Mini Pizza Toast", why: "Fun format that can hide a little veggie sauce.", cheese: "Use mozzarella or a grated cheese cube. Keep the layer thin.", steps: "Bread + very light hidden pumpkin/carrot sauce + cheese. Toast and cut into fingers." },
  { name: "Paneer Dosa", why: "Close to the idli/dosa family many toddlers already accept.", cheese: "Optional cheese spread - paneer mash is enough.", steps: "Make a plain dosa. Add paneer mash + ghee. Fold and cut into strips." },
  { name: "Ragi Banana Pancake", why: "Similar to a regular pancake, but adds iron.", cheese: "No cheese needed.", steps: "Mix banana + ragi flour + milk/egg + nut powder. Cook small pancakes in ghee." },
  { name: "Cheese Toast Fingers", why: "Good snack when a dry, predictable texture is wanted.", cheese: "Use a cheese slice for easiest melting, or grated cheese cube.", steps: "Toast bread with a thin cheese layer. Cut into long fingers. Offer cucumber on the side." },
  { name: "Stuffed Idli", why: "Uses an accepted idli format with hidden protein.", cheese: "Optional tiny grated cheese cube - paneer stuffing works better nutritionally.", steps: "Add idli batter, then a tiny paneer mash, then batter again. Steam as usual." },
];
