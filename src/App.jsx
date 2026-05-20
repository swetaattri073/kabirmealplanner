import React, { useEffect, useMemo, useState } from "react";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const mealSlots = ["Breakfast", "Mid-Morning", "Lunch", "Evening Snack", "Dinner"];

const basePlan = {
  Monday: {
    Breakfast: { meal: "Apple pancake", add: "Add nut powder + chia/flax powder + little banana mash." },
    "Mid-Morning": { meal: "Watermelon", add: "Good summer hydration. Add papaya cubes if accepted." },
    Lunch: { meal: "Paneer paratha + dahi", add: "Add spinach in dough and sesame powder in dahi." },
    "Evening Snack": { meal: "French toast", add: "Cook in ghee. Add mashed banana or cinnamon if accepted." },
    Dinner: { meal: "Cold khichdi fingers", add: "Use moong dal + tiny grated carrot hidden." },
  },
  Tuesday: {
    Breakfast: { meal: "Idli + ghee", add: "Add grated carrot in batter only if color change is tolerated." },
    "Mid-Morning": { meal: "Papaya", add: "Serve chilled in small cubes." },
    Lunch: { meal: "White rice + ghee + curd", add: "Keep rice white. Add only jeera/ghee/curd." },
    "Evening Snack": { meal: "Avocado toast", add: "Add a very thin cheese or paneer spread if accepted." },
    Dinner: { meal: "Pasta with hidden paneer sauce", add: "Blend paneer + milk + pumpkin/carrot + butter." },
  },
  Wednesday: {
    Breakfast: { meal: "Besan paneer cheela", add: "Add spinach puree very lightly so color change is mild." },
    "Mid-Morning": { meal: "Mango", add: "Pair with curd if he accepts mango yogurt." },
    Lunch: { meal: "Aloo sandwich", add: "Add cheese. Keep texture simple and predictable." },
    "Evening Snack": { meal: "Curd + crushed banana", add: "Add roasted nut powder or dates powder." },
    Dinner: { meal: "Ghee roti + dahi", add: "Keep cucumber/onion on side as no-pressure exposure." },
  },
  Thursday: {
    Breakfast: { meal: "Ragi banana pancake", add: "Add nut powder + dates powder for iron and energy." },
    "Mid-Morning": { meal: "Apple slices", add: "Offer with thin curd dip if accepted." },
    Lunch: { meal: "Paneer paratha + jeera curd", add: "Add grated lauki/carrot inside paratha only in tiny amounts." },
    "Evening Snack": { meal: "Mango yogurt popsicle", add: "Use full-fat curd + mango + tiny nut powder." },
    Dinner: { meal: "Macroni with hidden veggie sauce", add: "Paneer + pumpkin/carrot puree + butter/ghee." },
  },
  Friday: {
    Breakfast: { meal: "Idli with curd", add: "Add ghee on idli; keep curd plain." },
    "Mid-Morning": { meal: "Papaya + watermelon", add: "Hydration combo for summer." },
    Lunch: { meal: "White rice + ghee", add: "Keep dal separately nearby. Do not mix with rice." },
    "Evening Snack": { meal: "Cheese toast fingers", add: "Use whole wheat bread if accepted." },
    Dinner: { meal: "Khichdi finger pieces", add: "Moong dal + tiny spinach puree hidden." },
  },
  Saturday: {
    Breakfast: { meal: "French toast", add: "Egg + milk + ghee. Serve fruit on side." },
    "Mid-Morning": { meal: "Mango", add: "Serve chilled." },
    Lunch: { meal: "Besan paneer cheela + dahi", add: "Add grated carrot only in tiny amounts." },
    "Evening Snack": { meal: "Boiled potato with butter/ghee", add: "Sprinkle sesame powder if accepted." },
    Dinner: { meal: "Pasta", add: "Hidden paneer + carrot/pumpkin sauce." },
  },
  Sunday: {
    Breakfast: { meal: "Suji pancake / dosa", add: "Add curd in batter + nut powder if taste allows." },
    "Mid-Morning": { meal: "Mixed fruits", add: "Use accepted fruits: mango, apple, papaya, watermelon." },
    Lunch: { meal: "Paratha + dahi", add: "Cucumber/onion on side for exposure." },
    "Evening Snack": { meal: "Banana peanut butter mini sandwich", add: "Use thin peanut butter layer. Avoid chunks." },
    Dinner: { meal: "White rice + curd + ghee", add: "Simple safe meal day." },
  },
};

const exposureFoods = {
  Monday: {
    food: "1 tiny carrot stick or grated carrot",
    pairWith: "Paneer paratha / dahi",
    goal: "Only touch, smell, lick, or keep on plate. Eating is optional.",
  },
  Wednesday: {
    food: "1 boiled pea or tiny mashed pea dot",
    pairWith: "Aloo sandwich",
    goal: "Keep it separate, not mixed. Let Kabir decide whether to touch it.",
  },
  Friday: {
    food: "1 tiny dal drop in a separate spoon/bowl",
    pairWith: "White rice + ghee",
    goal: "Do not mix with rice. Just keep nearby without pressure.",
  },
  Sunday: {
    food: "1 soft lauki/pumpkin cube",
    pairWith: "Paratha + dahi",
    goal: "No pressure. Parent can eat it casually in front of him.",
  },
};

const recipes = [
  {
    name: "Paneer Pasta",
    why: "He already accepts pasta, so this is the easiest nutrition carrier.",
    cheese: "Use Amul/Britannia cheese cube or no cheese. Paneer is the main protein here.",
    steps: "Blend paneer + milk + tiny boiled pumpkin/carrot + butter. Mix with pasta. Keep sauce light in color.",
  },
  {
    name: "Cheese Corn Paratha",
    why: "Similar to paneer paratha, mild and familiar.",
    cheese: "Use cheese slice or grated mozzarella. Avoid too much processed cheese daily.",
    steps: "Mash boiled corn + potato + cheese. Stuff lightly in paratha. Serve with dahi.",
  },
  {
    name: "Curd Rice Balls",
    why: "Uses his safe foods: white rice, curd, ghee, and finger-food format.",
    cheese: "No cheese needed.",
    steps: "Mix cold rice + curd + ghee. Make small balls. Keep them white; avoid adding colored dal/sabji.",
  },
  {
    name: "Mini Pizza Toast",
    why: "Looks fun and can hide a little veggie sauce.",
    cheese: "Use mozzarella or grated cheese cube. Keep layer thin.",
    steps: "Bread + very light hidden pumpkin/carrot sauce + cheese. Toast and cut into fingers.",
  },
  {
    name: "Paneer Dosa",
    why: "Close to idli/dosa family, which he already accepts.",
    cheese: "Optional cheese spread. Paneer mash is enough.",
    steps: "Make plain dosa. Add paneer mash + ghee. Fold and cut into strips.",
  },
  {
    name: "Ragi Banana Pancake",
    why: "Similar to pancake, but adds iron.",
    cheese: "No cheese needed.",
    steps: "Mix banana + ragi flour + milk/egg + nut powder. Cook small pancakes in ghee.",
  },
  {
    name: "Cheese Toast Fingers",
    why: "Good snack when he wants something dry and predictable.",
    cheese: "Use cheese slice for easiest melting or grated cheese cube.",
    steps: "Toast bread with thin cheese layer. Cut into long fingers. Offer cucumber on side.",
  },
  {
    name: "Stuffed Idli",
    why: "Uses accepted idli format with hidden protein.",
    cheese: "Optional tiny grated cheese cube. Paneer stuffing works better nutritionally.",
    steps: "Add idli batter, then tiny paneer mash, then batter again. Steam as usual.",
  },
];

const safeFoods = [
  "Pasta", "Macroni", "Paneer paratha", "Apple pancake", "Avocado toast", "Ghee roti",
  "White rice", "Cold khichdi", "Watermelon", "Papaya", "Apple", "Mango", "Besan cheela",
  "Curd", "French toast", "Idli", "Cucumber", "Onion salad", "Aloo sandwich sometimes"
];

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function adjustPlan(plan, changes) {
  const adjusted = clone(plan);

  changes.forEach((change) => {
    if (!adjusted[change.day]) return;
    adjusted[change.day][change.slot] = {
      meal: change.meal,
      add: change.note || "Saved by you. Keep it safe and add nutrition gently.",
      changed: true,
    };

    const text = `${change.meal} ${change.note}`.toLowerCase();
    const startDay = days.indexOf(change.day);
    const startSlot = mealSlots.indexOf(change.slot);

    for (let d = startDay; d < days.length; d++) {
      for (let s = 0; s < mealSlots.length; s++) {
        if (d === startDay && s <= startSlot) continue;
        const item = adjusted[days[d]][mealSlots[s]];
        if (!item || item.changed) continue;

        if (text.includes("rice") && item.meal.toLowerCase().includes("rice")) {
          item.add = "Keep rice white. Use only ghee/jeera/curd. Keep dal/sabji separately nearby.";
        }
        if ((text.includes("pasta") || text.includes("macroni")) && item.meal.toLowerCase().includes("pasta")) {
          item.add = "Use hidden paneer + light pumpkin/carrot sauce for protein and vitamins.";
        }
      }
    }
  });

  return adjusted;
}

function getTip(changes) {
  if (!changes.length) return "Start with Kabir’s safe foods. Add nutrition in tiny amounts without changing color/texture too much.";
  const last = changes[changes.length - 1];
  const text = `${last.meal} ${last.note}`.toLowerCase();
  if (text.includes("rice")) return "Rice is sensitive for Kabir. Keep it white and put dal/sabji separately as exposure.";
  if (text.includes("pasta")) return "Pasta works well for Kabir. Use paneer + light hidden veggie sauce.";
  if (text.includes("reject") || text.includes("refuse") || text.includes("did not eat")) return "After rejection, avoid pressure. Offer one safe food and one tiny exposure food.";
  return "Good change. Balance the next meal with protein + fruit/curd + one safe carb.";
}

export default function App() {
  const [tab, setTab] = useState("day");
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [changes, setChanges] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("kabirMealChanges") || "[]");
    } catch {
      return [];
    }
  });
  const [day, setDay] = useState("Monday");
  const [slot, setSlot] = useState("Breakfast");
  const [meal, setMeal] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    localStorage.setItem("kabirMealChanges", JSON.stringify(changes));
  }, [changes]);

  const plan = useMemo(() => adjustPlan(basePlan, changes), [changes]);

  function saveChange() {
    if (!meal.trim()) return;
    setChanges([...changes, { id: Date.now(), day, slot, meal: meal.trim(), note: note.trim() }]);
    setSelectedDay(day);
    setTab("day");
    setMeal("");
    setNote("");
  }

  function deleteChange(id) {
    setChanges(changes.filter((c) => c.id !== id));
  }

  return (
    <div style={styles.page}>
      <div style={styles.app}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Kabir’s Meal Planner</h1>
            <p style={styles.subtitle}>Weekly toddler meal plan, nutrition tips, recipes, and gentle new-food exposure.</p>
          </div>
          <div style={styles.icon}>👶</div>
        </header>

        <div style={styles.tipBox}>
          <strong>Smart tip:</strong>
          <p style={styles.tipText}>{getTip(changes)}</p>
        </div>

        <div style={styles.tabs}>
          <button style={tab === "day" ? styles.activeTab : styles.tab} onClick={() => setTab("day")}>Day</button>
          <button style={tab === "week" ? styles.activeTab : styles.tab} onClick={() => setTab("week")}>Week</button>
          <button style={tab === "recipes" ? styles.activeTab : styles.tab} onClick={() => setTab("recipes")}>Recipes</button>
        </div>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Update a meal</h2>
          <div style={styles.row}>
            <select style={styles.input} value={day} onChange={(e) => setDay(e.target.value)}>
              {days.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select style={styles.input} value={slot} onChange={(e) => setSlot(e.target.value)}>
              {mealSlots.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <input style={styles.inputFull} placeholder="Example: White rice + ghee" value={meal} onChange={(e) => setMeal(e.target.value)} />
          <textarea style={styles.textarea} placeholder="Notes: ate well / rejected / added paneer / keep rice white" value={note} onChange={(e) => setNote(e.target.value)} />
          <button style={styles.primaryButton} onClick={saveChange}>Save & adjust future plan</button>
        </section>

        {tab === "day" && (
          <section>
            <select style={styles.daySelect} value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
              {days.map((d) => <option key={d}>{d}</option>)}
            </select>

            {exposureFoods[selectedDay] && (
              <div style={styles.exposureCard}>
                <p style={styles.label}>New food exposure today</p>
                <h3 style={styles.cardTitle}>{exposureFoods[selectedDay].food}</h3>
                <p><strong>Pair with:</strong> {exposureFoods[selectedDay].pairWith}</p>
                <p style={styles.small}>{exposureFoods[selectedDay].goal}</p>
              </div>
            )}

            {mealSlots.map((s) => {
              const item = plan[selectedDay][s];
              return (
                <div key={s} style={styles.mealCard}>
                  <p style={styles.label}>{s}</p>
                  <h3 style={styles.cardTitle}>{item.meal}</h3>
                  <div style={styles.nutritionBox}><strong>Nutrition add-on:</strong> {item.add}</div>
                  {item.changed && <span style={styles.badge}>Changed by you</span>}
                </div>
              );
            })}
          </section>
        )}

        {tab === "week" && (
          <section>
            {days.map((d) => (
              <div key={d} style={styles.card}>
                <h2 style={styles.sectionTitle}>{d}</h2>
                {exposureFoods[d] && (
                  <div style={styles.exposureMini}>
                    <strong>New food:</strong> {exposureFoods[d].food}<br />
                    <span>Pair with: {exposureFoods[d].pairWith}</span>
                  </div>
                )}
                {mealSlots.map((s) => (
                  <div key={s} style={styles.weekMeal}>
                    <strong>{s}</strong>
                    <p>{plan[d][s].meal}</p>
                    <small>+ {plan[d][s].add}</small>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {tab === "recipes" && (
          <section>
            {recipes.map((r) => (
              <div key={r.name} style={styles.mealCard}>
                <h3 style={styles.cardTitle}>{r.name}</h3>
                <p><strong>Why it may work:</strong> {r.why}</p>
                <p><strong>Which cheese to use:</strong> {r.cheese}</p>
                <div style={styles.nutritionBox}><strong>Recipe:</strong> {r.steps}</div>
              </div>
            ))}
          </section>
        )}

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Kabir’s safe foods</h2>
          <div style={styles.chips}>{safeFoods.map((f) => <span key={f} style={styles.chip}>{f}</span>)}</div>
        </section>

        {changes.length > 0 && (
          <section style={styles.card}>
            <div style={styles.spaceBetween}>
              <h2 style={styles.sectionTitle}>Saved changes</h2>
              <button style={styles.smallButton} onClick={() => setChanges([])}>Reset</button>
            </div>
            {changes.map((c) => (
              <div key={c.id} style={styles.changeRow}>
                <div>
                  <strong>{c.day} · {c.slot}</strong>
                  <p>{c.meal}</p>
                  {c.note && <small>{c.note}</small>}
                </div>
                <button style={styles.deleteButton} onClick={() => deleteChange(c.id)}>Delete</button>
              </div>
            ))}
          </section>
        )}

        <footer style={styles.footer}>Goal: safe foods + hidden nutrition + no-pressure exposure. Eating new foods is optional at this age.</footer>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 45%, #f0fdf4 100%)",
    padding: 16,
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#1f2937",
  },
  app: { maxWidth: 480, margin: "0 auto", paddingBottom: 40 },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 },
  title: { fontSize: 28, lineHeight: 1.1, margin: 0, fontWeight: 800 },
  subtitle: { margin: "6px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.4 },
  icon: { background: "#fff", padding: 12, borderRadius: 22, fontSize: 28, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" },
  tipBox: { background: "#fffbeb", borderRadius: 22, padding: 14, marginBottom: 12, boxShadow: "0 4px 14px rgba(0,0,0,0.04)" },
  tipText: { margin: "6px 0 0", fontSize: 14, color: "#475569" },
  tabs: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 },
  tab: { border: 0, background: "#fff", padding: "13px 8px", borderRadius: 18, fontWeight: 700, color: "#475569", boxShadow: "0 3px 10px rgba(0,0,0,0.04)" },
  activeTab: { border: 0, background: "#111827", color: "#fff", padding: "13px 8px", borderRadius: 18, fontWeight: 700, boxShadow: "0 3px 10px rgba(0,0,0,0.08)" },
  card: { background: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" },
  sectionTitle: { margin: "0 0 10px", fontSize: 18 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  input: { width: "100%", height: 44, borderRadius: 16, border: "1px solid #e5e7eb", padding: "0 10px", fontSize: 14, boxSizing: "border-box", background: "#fff" },
  inputFull: { width: "100%", height: 44, borderRadius: 16, border: "1px solid #e5e7eb", padding: "0 12px", fontSize: 14, marginTop: 8, boxSizing: "border-box" },
  textarea: { width: "100%", minHeight: 80, borderRadius: 16, border: "1px solid #e5e7eb", padding: 12, fontSize: 14, marginTop: 8, boxSizing: "border-box", fontFamily: "Arial" },
  primaryButton: { width: "100%", height: 46, marginTop: 8, border: 0, borderRadius: 18, background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 15 },
  daySelect: { width: "100%", height: 46, borderRadius: 18, border: "1px solid #e5e7eb", padding: "0 12px", fontSize: 15, marginBottom: 12, background: "#fff" },
  exposureCard: { background: "#faf5ff", borderRadius: 24, padding: 14, marginBottom: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.05)" },
  exposureMini: { background: "#faf5ff", borderRadius: 18, padding: 10, marginBottom: 10, fontSize: 14 },
  mealCard: { background: "#fff", borderRadius: 24, padding: 14, marginBottom: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" },
  label: { color: "#ea580c", textTransform: "uppercase", letterSpacing: 0.5, fontSize: 12, fontWeight: 800, margin: "0 0 6px" },
  cardTitle: { margin: "0 0 8px", fontSize: 19 },
  nutritionBox: { background: "#f0fdf4", borderRadius: 16, padding: 10, fontSize: 14, lineHeight: 1.4, marginTop: 8 },
  small: { background: "rgba(255,255,255,0.7)", padding: 10, borderRadius: 14, fontSize: 13, color: "#475569" },
  badge: { display: "inline-block", marginTop: 8, background: "#e0f2fe", color: "#0369a1", padding: "5px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700 },
  weekMeal: { background: "#f8fafc", borderRadius: 16, padding: 10, marginBottom: 8 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { background: "#f1f5f9", borderRadius: 999, padding: "7px 10px", fontSize: 13, fontWeight: 600 },
  spaceBetween: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  smallButton: { border: "1px solid #e5e7eb", background: "#fff", padding: "8px 10px", borderRadius: 14, fontWeight: 700 },
  changeRow: { display: "flex", justifyContent: "space-between", gap: 8, background: "#f8fafc", borderRadius: 16, padding: 10, marginTop: 8 },
  deleteButton: { border: 0, background: "#fee2e2", color: "#991b1b", borderRadius: 12, padding: "8px 10px", height: 36, fontWeight: 700 },
  footer: { textAlign: "center", color: "#64748b", fontSize: 13, padding: "12px 8px" },
};
