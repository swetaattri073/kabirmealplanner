// Flags foods that aren't recommended for infants/toddlers, and says why.
// This is general public-health guidance (AAP/WHO/NHS-style choking-hazard,
// botulism, and food-safety basics), not a medical assessment of any one
// child - always defer to your pediatrician for individual guidance,
// especially around allergen introduction and any existing condition.
//
// Two things intentionally kept separate:
// - `ingredients[].name` are USDA search terms (e.g. "carrot, raw") used
//   purely to look up nutrition data - "raw" there often just means "the
//   raw form is the USDA reference point", not "served raw". So texture/
//   preparation checks (choking hazards) read the food's own name/notes,
//   which describe how it's actually made and served; only checks where
//   the ingredient's identity itself is the concern (honey, high-mercury
//   fish, caffeine, milk-as-a-drink) read the ingredients list.
// - Rules are worded as cautions tied to a preparation/serving form where
//   that's the real issue (e.g. nuts are fine ground, not whole), and as
//   flat avoid-at-this-age calls where the ingredient itself is the issue
//   regardless of how it's prepared (honey, caffeine, high-mercury fish).

function textFields(food) {
  return [food.name, food.addNote, food.exposureGoal].filter(Boolean).join(" ").toLowerCase();
}

function ingredientNames(food) {
  return (food.ingredients || []).map((i) => i.name.toLowerCase());
}

function hasWord(text, regex) {
  return regex.test(text);
}

const DISH_CONTEXT_WORDS = /\b(khichdi|paratha|cheela|pasta|sauce|soup|porridge|mash|mashed|puree|pureed|cooked|steamed|boiled|dal|roti|dosa|pancake|sandwich|toast|curry|idli)\b/i;

export const SAFETY_RULES = [
  {
    id: "honey",
    label: "Honey",
    severity: "avoid",
    reason: "Honey (raw or cooked into food) can contain bacterial spores that cause infant botulism.",
    recommendation: "Avoid completely before 12 months. Fine to introduce after their first birthday.",
    alternative: "Sweeten with mashed ripe banana, unsweetened stewed apple/pear, or a little date paste instead - similar sweetness, no botulism risk.",
    test: (food) => hasWord(textFields(food), /\bhoney\b/i) || ingredientNames(food).some((n) => n.includes("honey")),
  },
  {
    id: "high-mercury-fish",
    label: "High-mercury fish",
    severity: "avoid",
    reason: "This fish is high in mercury, which can affect a young child's developing nervous system.",
    recommendation: "Avoid for infants/toddlers - choose low-mercury options like salmon, tilapia, or light canned tuna instead.",
    alternative: "Try salmon, tilapia, cod, or light canned tuna instead - similar texture and flavor, far lower mercury.",
    test: (food) => {
      const re = /\b(shark|swordfish|king mackerel|tilefish|marlin|bigeye tuna|orange roughy)\b/i;
      return hasWord(textFields(food), re) || ingredientNames(food).some((n) => re.test(n));
    },
  },
  {
    id: "caffeine",
    label: "Caffeine",
    severity: "avoid",
    reason: "Caffeine isn't recommended for infants or toddlers - it can affect sleep, heart rate, and appetite.",
    recommendation: "Avoid coffee, tea, cola, and energy drinks for this age group.",
    alternative: "Offer water, milk, or a caffeine-free kid-friendly herbal infusion instead.",
    test: (food) => {
      const re = /\b(coffee|energy drink|cola)\b/i;
      const teaRe = /\btea\b(?!\s?spoon)/i;
      const text = textFields(food);
      return hasWord(text, re) || teaRe.test(text) || ingredientNames(food).some((n) => re.test(n) || teaRe.test(n));
    },
  },
  {
    id: "unpasteurized",
    label: "Unpasteurized dairy/juice",
    severity: "avoid",
    reason: "Unpasteurized dairy or juice can carry harmful bacteria that are especially risky for young children.",
    recommendation: "Use pasteurized versions only.",
    alternative: "Use the pasteurized version of the same product - same taste and use, without the bacterial risk.",
    test: (food) => hasWord(textFields(food), /unpasteurized|raw milk/i) || ingredientNames(food).some((n) => /unpasteurized|raw milk/.test(n)),
  },
  {
    id: "undercooked-protein",
    label: "Raw or undercooked protein",
    severity: "avoid",
    reason: "Undercooked eggs, meat, or fish carry a higher food-poisoning risk, which hits young children harder.",
    recommendation: "Cook eggs, meat, and fish thoroughly before serving.",
    alternative: "Serve the same egg/meat/fish fully cooked through (firm yolk, no pink centers) instead of raw or runny.",
    test: (food) => hasWord(textFields(food), /\b(sushi|raw egg|runny egg|undercooked|rare steak|raw meat|raw fish)\b/i),
  },
  {
    id: "popcorn",
    label: "Popcorn",
    severity: "avoid",
    reason: "Whole popcorn kernels and unpopped bits are a serious choking hazard for young children.",
    recommendation: "Avoid popcorn until your child is older (most guidance says around age 4).",
    alternative: "Try puffed rice/wheat cereal, small soft rice-cake pieces, or roasted sweet potato fries instead - similar snacky crunch-free texture.",
    test: (food) => hasWord(textFields(food), /\bpopcorn\b/i),
  },
  {
    id: "hard-candy-gum",
    label: "Hard candy / gum",
    severity: "avoid",
    reason: "Hard candy and gum are a choking hazard and offer no nutritional benefit at this age.",
    recommendation: "Avoid for infants/toddlers.",
    alternative: "Offer soft mashed fruit, a smooth yogurt, or a homemade soft fruit popsicle instead.",
    test: (food) => hasWord(textFields(food), /\b(hard candy|chewing gum|cough drop)\b/i),
  },
  {
    id: "whole-grapes-tomatoes",
    label: "Whole grapes / cherry tomatoes",
    severity: "modify",
    reason: "Whole grapes and cherry tomatoes are a top choking hazard - round, firm, and just the wrong size for a toddler's airway.",
    recommendation: "Always quarter lengthwise (not just in half) before serving.",
    alternative: "Serve the same grapes/cherry tomatoes quartered lengthwise, or swap in soft mashed berries or melon cubes.",
    test: (food) => {
      const text = textFields(food);
      const hasFood = /\b(grapes?|cherry tomato(es)?|cherries)\b/i.test(text);
      const alreadySafe = /\b(quarter|quartered|halved|halve|sliced|cut up|mashed|puree)\b/i.test(text);
      return hasFood && !alreadySafe;
    },
  },
  {
    id: "hot-dog-sausage",
    label: "Hot dog / sausage rounds",
    severity: "modify",
    reason: "Hot dogs and sausages sliced into coins are a classic choking hazard shape.",
    recommendation: "Slice lengthwise into quarters, then into small pieces - never serve as round coins.",
    alternative: "Serve the same hot dog/sausage sliced lengthwise into thin strips, or swap in soft shredded chicken or scrambled egg.",
    test: (food) => {
      const text = textFields(food);
      const hasFood = /\b(hot dog|sausage|frankfurter)\b/i.test(text);
      const alreadySafe = /\b(sliced lengthwise|quartered|chopped|diced|small pieces)\b/i.test(text);
      return hasFood && !alreadySafe;
    },
  },
  {
    id: "whole-nuts-seeds",
    label: "Whole nuts / seeds",
    severity: "modify",
    reason: "Whole nuts and seeds are a choking hazard for young children (typically flagged as unsafe whole until around age 4-5).",
    recommendation: "Only offer finely ground, as a smooth nut butter spread thin, or as flour/powder mixed into food - never whole.",
    alternative: "Swap in a thin layer of smooth nut butter, nut powder mixed into food, or a nut-free option like soft cheese cubes or banana.",
    test: (food) => {
      const text = textFields(food);
      const ingredients = ingredientNames(food).join(" ");
      const combined = `${text} ${ingredients}`
        // "mature seeds" is just USDA's botanical name for lentils/legumes
        // (e.g. "lentils, mature seeds, cooked") - not an edible-seed
        // choking hazard, so strip it before matching.
        .replace(/mature seeds/gi, "")
        // "remove/discard/deseeded"/"no whole nuts" etc. mean the nuts or
        // seeds explicitly aren't being served whole - the opposite of the
        // concern this rule is about.
        .replace(/\b(remove|discard|without|no|not\s+using)\s+(whole\s+|the\s+)?(nuts?|peanuts?|almonds?|cashews?|walnuts?|seeds?)\b/gi, "")
        .replace(/de-?seeded|seedless|nut-?free/gi, "");
      const hasFood = /\b(nuts?|peanuts?|almonds?|cashews?|walnuts?|seeds?)\b/i.test(combined);
      const alreadySafe = /\b(powder|butter|flour|ground|smooth|paste)\b/i.test(combined);
      return hasFood && !alreadySafe;
    },
  },
  {
    id: "thick-peanut-butter",
    label: "Thick peanut butter",
    severity: "modify",
    reason: "A thick spoonful or blob of peanut butter can stick to the roof of the mouth or throat and cause gagging/choking.",
    recommendation: "Spread in a very thin layer - never serve by the spoonful.",
    alternative: "Spread the same peanut butter in a thin layer on toast or fruit slices instead of serving a spoonful.",
    test: (food) => {
      const text = textFields(food);
      const ingredients = ingredientNames(food).join(" ");
      const hasPB = /peanut butter/i.test(text) || /peanut butter/i.test(ingredients);
      const alreadySafe = /\b(thin|spread thin)\b/i.test(text);
      return hasPB && !alreadySafe;
    },
  },
  {
    id: "raw-hard-veg-fruit",
    label: "Firm raw fruit/veg pieces",
    severity: "modify",
    reason: "Firm raw pieces (carrot, apple, celery, cucumber) are a top choking hazard for young children.",
    recommendation: "Steam or cook until soft, or cut into long thin matchsticks rather than coins/chunks - always supervise.",
    alternative: "Serve the same vegetable/fruit steamed soft or cut into thin matchsticks instead of a raw chunk or coin.",
    test: (food) => {
      const text = textFields(food);
      const hasFood = /\b(carrot|apple|celery|cucumber)\b/i.test(text);
      const textureCue = /\b(stick|chunk|raw|slice)\b/i.test(text);
      const dishContext = DISH_CONTEXT_WORDS.test(text);
      return hasFood && textureCue && !dishContext;
    },
  },
  {
    id: "added-salt-sugar",
    label: "Added salt / sugar",
    severity: "limit",
    reason: "Guidance recommends no added salt before 12 months and minimal added sugar overall at this age.",
    recommendation: "Skip added salt/sugar - let natural flavor from fruit, ghee, or mild spices carry the dish.",
    alternative: "Flavor with ghee, mild spices (jeera, cinnamon), or naturally sweet fruit instead of added salt/sugar.",
    test: (food) => hasWord(textFields(food), /\b(added salt|extra salt|added sugar|extra sugar|sugar syrup)\b/i),
  },
  {
    id: "cow-milk-as-drink",
    label: "Cow's milk as a main drink",
    severity: "limit",
    reason: "Cow's milk as a primary drink (as opposed to a cooking ingredient) isn't recommended before 12 months.",
    recommendation: "Keep breastmilk/formula as the main drink before 12 months; small amounts of milk used in cooking are fine at any point solids have started.",
    alternative: "Offer breastmilk or formula as the main drink, and keep cow's milk to small amounts mixed into food until 12 months.",
    test: (food) => (food.ingredients || []).some((i) => /^milk\b/i.test(i.name) && i.grams >= 150),
  },
];

// Returns the list of matched rules (each with label/severity/reason/recommendation)
// for one food. Empty array means nothing was flagged.
export function checkFoodSafety(food) {
  return SAFETY_RULES.filter((rule) => rule.test(food)).map((rule) => ({
    id: rule.id,
    label: rule.label,
    severity: rule.severity,
    reason: rule.reason,
    recommendation: rule.recommendation,
    alternative: rule.alternative,
  }));
}

// Runs the check across every food in a profile, returning only foods that
// have at least one flag: [{ food, warnings }].
export function checkProfileSafety(foods) {
  return foods
    .map((food) => ({ food, warnings: checkFoodSafety(food) }))
    .filter((entry) => entry.warnings.length > 0);
}
