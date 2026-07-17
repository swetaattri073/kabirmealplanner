import { useEffect, useMemo, useState } from "react";
import {
  DAYS,
  DEFAULT_MEAL_SLOTS,
  FOOD_CATEGORIES,
  ADVENTUROUSNESS_PRESETS,
  createFood,
  generateWeekPlan,
  logResponse,
  addParentNote,
  getTip,
} from "./foodEngine";
import { createExampleProfile, createBlankProfile, createInfantStarterProfile, recipes } from "./defaultProfile";
import { fetchNutritionForFood, refreshAllNutrition, checkNutritionProxyHealth } from "./nutritionApi";
import { checkProfileSafety } from "./foodSafety";
import { checkChatHealth, sendChatTurn } from "./chatApi";
import { buildSystemPrompt, findMatchingFood, LOG_FOOD_FEEDBACK_TOOL } from "./chatAssistant";

// JS Date.getDay() is 0=Sunday..6=Saturday; DAYS is Monday-first.
function todayName() {
  const jsDay = new Date().getDay();
  return DAYS[(jsDay + 6) % 7];
}

const STORAGE_KEY = "toddlerMealPlanner.profiles.v2";
const ACTIVE_KEY = "toddlerMealPlanner.activeProfileId.v2";

function loadProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    /* fall through to seed */
  }
  return [createExampleProfile("Kabir")];
}

function loadActiveId(profiles) {
  const saved = localStorage.getItem(ACTIVE_KEY);
  if (saved && profiles.some((p) => p.id === saved)) return saved;
  return profiles[0].id;
}

const RESPONSE_BUTTONS = [
  { key: "accepted", label: "😊 Ate it" },
  { key: "partial", label: "🙂 Tried a little" },
  { key: "refused", label: "😐 Refused" },
];

export default function App() {
  const [profiles, setProfiles] = useState(loadProfiles);
  const [activeProfileId, setActiveProfileId] = useState(() => loadActiveId(loadProfiles()));
  const [tab, setTab] = useState("day");
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [addingProfile, setAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileTemplate, setNewProfileTemplate] = useState("blank");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [foodForm, setFoodForm] = useState({
    name: "",
    category: "carb",
    status: "safe",
    suitableSlots: [],
    addNote: "",
    exposureGoal: "",
    ingredientsText: "",
  });
  const [nutritionStatus, setNutritionStatus] = useState(null); // { ok, usingDemoKey, error }
  const [lookupInFlight, setLookupInFlight] = useState({}); // foodId -> true while fetching
  const [bulkRefresh, setBulkRefresh] = useState(null); // { done, total } while a "refresh all" pass runs
  const [chatStatus, setChatStatus] = useState(null); // { ok, error }
  const [chatMessages, setChatMessages] = useState([]); // [{ role: "user"|"assistant", content }]
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    checkNutritionProxyHealth().then(setNutritionStatus);
    checkChatHealth().then(setChatStatus);
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const mealSlots = activeProfile.mealSlots && activeProfile.mealSlots.length ? activeProfile.mealSlots : DEFAULT_MEAL_SLOTS;
  const plan = useMemo(() => generateWeekPlan(activeProfile), [activeProfile]);
  const tip = useMemo(() => getTip(activeProfile), [activeProfile]);
  const safetyFlags = useMemo(() => checkProfileSafety(activeProfile.foods), [activeProfile]);
  const safetyByFoodId = useMemo(() => {
    const map = {};
    safetyFlags.forEach(({ food, warnings }) => { map[food.id] = warnings; });
    return map;
  }, [safetyFlags]);

  function updateProfile(next) {
    setProfiles((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }

  function handleLog(day, slot, foodId, response) {
    if (!foodId) return;
    updateProfile(logResponse(activeProfile, { day, slot, foodId, response }));
  }

  function handleAddProfile() {
    const name = newProfileName.trim();
    if (!name) return;
    const profile =
      newProfileTemplate === "infant6mo" ? createInfantStarterProfile(name)
      : newProfileTemplate === "toddlerExample" ? createExampleProfile(name)
      : createBlankProfile(name);
    setProfiles((prev) => [...prev, profile]);
    setActiveProfileId(profile.id);
    setNewProfileName("");
    setNewProfileTemplate("blank");
    setAddingProfile(false);
  }

  function handleRenameProfile() {
    const name = renameValue.trim();
    if (!name) return;
    updateProfile({ ...activeProfile, name });
    setRenaming(false);
  }

  function handleDeleteProfile() {
    if (profiles.length <= 1) return;
    if (!window.confirm(`Delete ${activeProfile.name}'s profile? This cannot be undone.`)) return;
    const remaining = profiles.filter((p) => p.id !== activeProfile.id);
    setProfiles(remaining);
    setActiveProfileId(remaining[0].id);
  }

  function toggleSlotInForm(slot) {
    setFoodForm((f) => ({
      ...f,
      suitableSlots: f.suitableSlots.includes(slot) ? f.suitableSlots.filter((s) => s !== slot) : [...f.suitableSlots, slot],
    }));
  }

  // Parses "rice, white, cooked:100; ghee:5" into [{name, grams}, ...] so a
  // parent can add real ingredients for a new food without a lot of UI.
  function parseIngredientsText(text) {
    return text
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.lastIndexOf(":");
        if (idx === -1) return { name: part.trim(), grams: 50 };
        const name = part.slice(0, idx).trim();
        const grams = Number(part.slice(idx + 1).trim()) || 50;
        return { name, grams };
      });
  }

  function handleAddFood() {
    if (!foodForm.name.trim() || !foodForm.suitableSlots.length) return;
    const food = createFood({
      name: foodForm.name.trim(),
      category: foodForm.category,
      suitableSlots: foodForm.suitableSlots,
      status: foodForm.status,
      addNote: foodForm.addNote.trim(),
      exposureGoal: foodForm.exposureGoal.trim(),
      ingredients: parseIngredientsText(foodForm.ingredientsText),
    });
    updateProfile({ ...activeProfile, foods: [...activeProfile.foods, food] });
    setFoodForm({ name: "", category: "carb", status: "safe", suitableSlots: [], addNote: "", exposureGoal: "", ingredientsText: "" });
  }

  function retireFood(foodId) {
    updateProfile({
      ...activeProfile,
      foods: activeProfile.foods.map((f) => (f.id === foodId ? { ...f, status: "retired", retiredFrom: f.status } : f)),
    });
  }

  function reinstateFood(foodId) {
    updateProfile({
      ...activeProfile,
      foods: activeProfile.foods.map((f) => (f.id === foodId ? { ...f, status: f.retiredFrom || "safe" } : f)),
    });
  }

  async function lookupNutrition(food) {
    setLookupInFlight((prev) => ({ ...prev, [food.id]: true }));
    try {
      const nutrition = await fetchNutritionForFood(food);
      updateProfile({
        ...activeProfile,
        foods: activeProfile.foods.map((f) => (f.id === food.id ? { ...f, nutrition } : f)),
      });
    } catch (err) {
      updateProfile({
        ...activeProfile,
        foods: activeProfile.foods.map((f) => (f.id === food.id ? { ...f, nutrition: { perServing: {}, matchedIngredients: [], unmatched: [`Lookup failed: ${err.message}`], fetchedAt: new Date().toISOString() } } : f)),
      });
    } finally {
      setLookupInFlight((prev) => ({ ...prev, [food.id]: false }));
    }
  }

  async function refreshAllFoodsNutrition() {
    const foods = activeProfile.foods;
    if (!foods.length) return;
    setBulkRefresh({ done: 0, total: foods.length });
    const results = await refreshAllNutrition(foods, {
      onProgress: (done, total) => setBulkRefresh({ done, total }),
    });
    updateProfile({
      ...activeProfile,
      foods: activeProfile.foods.map((f) => (results[f.id] ? { ...f, nutrition: results[f.id] } : f)),
    });
    setBulkRefresh(null);
  }

  async function handleSendChat() {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    setChatError("");
    setChatInput("");
    const userMessage = { role: "user", content: text };
    const historyForDisplay = [...chatMessages, userMessage];
    setChatMessages(historyForDisplay);
    setChatBusy(true);

    try {
      const systemMessage = { role: "system", content: buildSystemPrompt({ profile: activeProfile, plan, today: todayName() }) };
      let apiMessages = [systemMessage, ...historyForDisplay];

      let assistantMsg = await sendChatTurn(apiMessages, { tools: [LOG_FOOD_FEEDBACK_TOOL] });

      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length) {
        const call = assistantMsg.tool_calls[0];
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* leave args empty if the model sent malformed JSON */
        }

        const match = findMatchingFood(activeProfile.foods, args.foodName);
        let updatedProfile;
        if (args.response === "note_only" || !match) {
          const notePrefix = !match && args.foodName ? `(no exact food match for "${args.foodName}") ` : "";
          updatedProfile = addParentNote(activeProfile, { foodId: match ? match.id : null, note: `${notePrefix}${args.note || ""}`.trim() });
        } else {
          updatedProfile = logResponse(activeProfile, {
            day: todayName(),
            slot: match.suitableSlots[0] || "Chat",
            foodId: match.id,
            response: args.response,
            note: args.note || "",
          });
        }
        updateProfile(updatedProfile);

        const toolResultMessage = {
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ applied: true, matchedFood: match ? match.name : null }),
        };
        apiMessages = [...apiMessages, assistantMsg, toolResultMessage];
        assistantMsg = await sendChatTurn(apiMessages, { tools: [LOG_FOOD_FEEDBACK_TOOL] });
      }

      setChatMessages([...historyForDisplay, { role: "assistant", content: assistantMsg.content || "Got it." }]);
    } catch (err) {
      setChatError(err.message);
    } finally {
      setChatBusy(false);
    }
  }

  function clearChat() {
    setChatMessages([]);
    setChatError("");
  }

  function updateSettings(partial) {
    updateProfile({ ...activeProfile, settings: { ...activeProfile.settings, ...partial } });
  }

  function applyAdventurousness(level) {
    updateSettings({ adventurousness: level, ...ADVENTUROUSNESS_PRESETS[level] });
  }

  function clearHistory() {
    updateProfile({ ...activeProfile, log: [] });
  }

  return (
    <div style={styles.page}>
      <div style={styles.app}>
        <header style={styles.brandBar}>
          <div style={styles.brandLockup}>
            <img src="/littlebowl-mark.png" alt="LittleBowl" width={48} height={48} style={styles.brandMark} />
            <div>
              <p style={styles.brandName}>
                <span style={styles.brandLittle}>Little</span>
                <span style={styles.brandBowl}>Bowl</span>
              </p>
              <p style={styles.brandTagline}>Little meals, big growth.</p>
            </div>
          </div>
        </header>

        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{activeProfile.name}&apos;s meals</h1>
            <p style={styles.subtitle}>Weekly plan, nutrition tips, and gentle new-food exposure — personalized for your toddler.</p>
          </div>
        </header>

        <section style={styles.card}>
          <div style={styles.spaceBetween}>
            <select style={styles.input} value={activeProfileId} onChange={(e) => setActiveProfileId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div style={styles.profileActions}>
              <button style={styles.smallButton} onClick={() => { setRenaming(true); setRenameValue(activeProfile.name); }}>Rename</button>
              <button style={styles.smallButton} onClick={() => setAddingProfile(true)}>+ Add toddler</button>
              {profiles.length > 1 && <button style={styles.deleteButton} onClick={handleDeleteProfile}>Delete</button>}
            </div>
          </div>

          {renaming && (
            <div style={styles.row}>
              <input style={styles.inputFull} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Toddler's name" />
              <button style={styles.primaryButton} onClick={handleRenameProfile}>Save name</button>
            </div>
          )}

          {addingProfile && (
            <div>
              <input style={styles.inputFull} value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="New toddler's name" />
              <p style={styles.label}>Starting point</p>
              <select style={styles.input} value={newProfileTemplate} onChange={(e) => setNewProfileTemplate(e.target.value)}>
                <option value="blank">Blank - I'll add foods myself</option>
                <option value="infant6mo">6 months+ starter (mashed foods & purees)</option>
                <option value="toddlerExample">Toddler example (finger foods, exposure)</option>
              </select>
              <button style={styles.primaryButton} onClick={handleAddProfile}>Create profile</button>
            </div>
          )}
        </section>

        <div style={styles.tipBox}>
          <strong>Smart tip:</strong>
          <p style={styles.tipText}>{tip}</p>
        </div>

        <div style={styles.tabsWrap}>
          {["day", "week", "foods", "chat", "settings", "recipes"].map((t) => (
            <button key={t} style={tab === t ? styles.activeTab : styles.tab} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "day" && (
          <section>
            <select style={styles.daySelect} value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select>

            {mealSlots.map((slot) => {
              const item = plan[selectedDay][slot];
              const foodNutrition = activeProfile.foods.find((f) => f.id === item.foodId)?.nutrition?.perServing;
              const warnings = item.foodId ? safetyByFoodId[item.foodId] : null;
              return (
                <div key={slot} style={styles.mealCard}>
                  <p style={styles.label}>{slot}</p>
                  <h3 style={styles.cardTitle}>{item.meal}</h3>
                  {item.isExposure && <span style={styles.exposureBadge}>New food exposure</span>}
                  <div style={styles.nutritionBox}><strong>{item.isExposure ? "Exposure goal" : "Nutrition add-on"}:</strong> {item.add}</div>
                  {item.exposureProgress && <p style={styles.small}>{item.exposureProgress}</p>}
                  {warnings && warnings.map((w) => (
                    <div key={w.id} style={w.severity === "avoid" ? styles.safetyAvoid : styles.safetyModify}>
                      <strong>⚠ {w.label}:</strong> {w.reason} <em>{w.recommendation}</em>
                      {w.alternative && <><br /><strong>Try instead:</strong> {w.alternative}</>}
                    </div>
                  ))}
                  {foodNutrition && Object.keys(foodNutrition).length > 0 && (
                    <p style={styles.small}>
                      Real data (USDA): {foodNutrition.calories != null ? `${foodNutrition.calories} kcal` : "?"}
                      {foodNutrition.protein_g != null ? ` · ${foodNutrition.protein_g}g protein` : ""}
                      {foodNutrition.iron_mg != null ? ` · ${foodNutrition.iron_mg}mg iron` : ""} per serving
                    </p>
                  )}

                  {item.foodId ? (
                    <div style={styles.responseRow}>
                      {RESPONSE_BUTTONS.map((b) => (
                        <button key={b.key} style={styles.responseButton} onClick={() => handleLog(selectedDay, slot, item.foodId, b.key)}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={styles.small}>Add a food for this slot in the Foods tab to start planning it.</p>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {tab === "week" && (
          <section>
            {DAYS.map((d) => (
              <div key={d} style={styles.card}>
                <h2 style={styles.sectionTitle}>{d}</h2>
                {mealSlots.map((slot) => {
                  const item = plan[d][slot];
                  const warnings = item.foodId ? safetyByFoodId[item.foodId] : null;
                  return (
                    <div key={slot} style={styles.weekMeal}>
                      <strong>{slot}</strong> {item.isExposure && <span style={styles.exposureBadge}>New food</span>}
                      {warnings && warnings.length > 0 && <span style={styles.safetyBadgeMini}>⚠ {warnings.length} note{warnings.length > 1 ? "s" : ""}</span>}
                      <p>{item.meal}</p>
                      <small>+ {item.add}</small>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        )}

        {tab === "foods" && (
          <section>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Add a food</h2>
              <input style={styles.inputFull} placeholder="Food name" value={foodForm.name} onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })} />
              <div style={styles.row}>
                <select style={styles.input} value={foodForm.category} onChange={(e) => setFoodForm({ ...foodForm, category: e.target.value })}>
                  {FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select style={styles.input} value={foodForm.status} onChange={(e) => setFoodForm({ ...foodForm, status: e.target.value })}>
                  <option value="safe">Safe food</option>
                  <option value="exposure">New / exposure food</option>
                </select>
              </div>
              <p style={styles.label}>Which meals fit this food?</p>
              <div style={styles.chips}>
                {mealSlots.map((slot) => (
                  <button
                    key={slot}
                    style={foodForm.suitableSlots.includes(slot) ? styles.chipActive : styles.chip}
                    onClick={() => toggleSlotInForm(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              {foodForm.status === "safe" ? (
                <textarea style={styles.textarea} placeholder="Nutrition add-on note (optional): e.g. add nut powder" value={foodForm.addNote} onChange={(e) => setFoodForm({ ...foodForm, addNote: e.target.value })} />
              ) : (
                <textarea style={styles.textarea} placeholder="Exposure goal (optional): e.g. touch, smell, or lick only - eating is optional" value={foodForm.exposureGoal} onChange={(e) => setFoodForm({ ...foodForm, exposureGoal: e.target.value })} />
              )}
              <textarea
                style={styles.textarea}
                placeholder="Ingredients for real nutrition data (optional): rice, white, cooked:100; ghee:5"
                value={foodForm.ingredientsText}
                onChange={(e) => setFoodForm({ ...foodForm, ingredientsText: e.target.value })}
              />
              <p style={styles.small}>Format: ingredient name : grams, separated by semicolons. Use plain USDA-style names (e.g. "banana, raw") for the best match.</p>
              <button style={styles.primaryButton} onClick={handleAddFood}>Add food</button>
            </section>

            <section style={styles.card}>
              <p style={styles.small}>
                Foods are never deleted just for being refused - toddlers often need 10-15 tries before accepting something new.
                Use “Retire” only for foods you want to fully stop offering (e.g. an allergy).
              </p>
              {nutritionStatus && !nutritionStatus.ok && (
                <p style={styles.warningText}>
                  Nutrition lookups aren't available right now ({nutritionStatus.error || "proxy unreachable"}). Run <code>npm run server</code> in a separate terminal (see README) and reload.
                </p>
              )}
              {nutritionStatus && nutritionStatus.ok && nutritionStatus.usingDemoKey && (
                <p style={styles.warningText}>
                  Using USDA's shared DEMO_KEY (30 requests/hour, 50/day) - fine for trying things out, but get your own free key at fdc.nal.usda.gov/api-key-signup for real use.
                </p>
              )}
              <div style={styles.spaceBetween}>
                <span style={styles.small}>Nutrition data comes from USDA FoodData Central, resolved per ingredient.</span>
                <button style={styles.smallButton} onClick={refreshAllFoodsNutrition} disabled={!!bulkRefresh}>
                  {bulkRefresh ? `Refreshing ${bulkRefresh.done}/${bulkRefresh.total}...` : "Refresh nutrition for all foods"}
                </button>
              </div>
            </section>

            {safetyFlags.length > 0 && (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>⚠ Safety notes ({safetyFlags.length} food{safetyFlags.length > 1 ? "s" : ""})</h2>
                <p style={styles.small}>
                  General infant/toddler feeding guidance (choking hazards, botulism risk, food safety) - not a medical assessment of your child. Check with your pediatrician for anything specific to them.
                </p>
                {safetyFlags.map(({ food, warnings }) => (
                  <div key={food.id} style={styles.foodRow}>
                    <div>
                      <strong>{food.name}</strong>
                      {warnings.map((w) => (
                        <div key={w.id} style={w.severity === "avoid" ? styles.safetyAvoid : w.severity === "limit" ? styles.safetyLimit : styles.safetyModify}>
                          <strong>{w.severity === "avoid" ? "Avoid: " : w.severity === "limit" ? "Limit: " : "Modify: "}{w.label}.</strong> {w.reason} <em>{w.recommendation}</em>
                          {w.alternative && <><br /><strong>Try instead:</strong> {w.alternative}</>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {FOOD_CATEGORIES.map((cat) => {
              const items = activeProfile.foods.filter((f) => f.category === cat);
              if (!items.length) return null;
              return (
                <section key={cat} style={styles.card}>
                  <h2 style={styles.sectionTitle}>{cat[0].toUpperCase() + cat.slice(1)}</h2>
                  {items.map((f) => {
                    const n = f.nutrition?.perServing;
                    return (
                      <div key={f.id} style={styles.foodRow}>
                        <div>
                          <strong>{f.name}</strong>{" "}
                          <span style={f.status === "safe" ? styles.badge : f.status === "exposure" ? styles.exposureBadge : styles.retiredBadge}>
                            {f.status}
                          </span>
                          {safetyByFoodId[f.id] && <span style={styles.safetyBadgeMini}>⚠ {safetyByFoodId[f.id].length} safety note{safetyByFoodId[f.id].length > 1 ? "s" : ""}</span>}
                          <p style={styles.small}>
                            Slots: {f.suitableSlots.join(", ")} · Offered {f.timesOffered}x · Accepted {f.timesAccepted}x · Refused {f.timesRejected}x
                          </p>
                          {n && Object.keys(n).length > 0 && (
                            <p style={styles.small}>
                              Per serving: {n.calories != null ? `${n.calories} kcal` : "?"} · {n.protein_g != null ? `${n.protein_g}g protein` : ""} · {n.iron_mg != null ? `${n.iron_mg}mg iron` : ""}
                              {f.nutrition.unmatched?.length ? ` · no match for: ${f.nutrition.unmatched.join(", ")}` : ""}
                            </p>
                          )}
                          {!f.ingredients?.length && <p style={styles.small}>No ingredients set - add some to enable a nutrition lookup.</p>}
                        </div>
                        <div style={styles.profileActions}>
                          {!!f.ingredients?.length && (
                            <button style={styles.smallButton} onClick={() => lookupNutrition(f)} disabled={!!lookupInFlight[f.id]}>
                              {lookupInFlight[f.id] ? "Looking up..." : n ? "Refresh" : "Look up nutrition"}
                            </button>
                          )}
                          {f.status === "retired" ? (
                            <button style={styles.smallButton} onClick={() => reinstateFood(f.id)}>Reinstate</button>
                          ) : (
                            <button style={styles.smallButton} onClick={() => retireFood(f.id)}>Retire</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
            {!activeProfile.foods.length && <p style={styles.small}>No foods yet - add a few above to start generating a plan for {activeProfile.name}.</p>}
          </section>
        )}

        {tab === "chat" && (
          <section style={styles.card}>
            <div style={styles.spaceBetween}>
              <h2 style={styles.sectionTitle}>Ask about {activeProfile.name}'s food</h2>
              {chatMessages.length > 0 && <button style={styles.smallButton} onClick={clearChat}>Clear chat</button>}
            </div>
            <p style={styles.small}>
              Ask what's on today's plan, whether a food is a good idea for a toddler/infant, or just tell it things like "he doesn't eat carrots" or "she's been picky all week" - it'll note that for future planning.
            </p>
            {chatStatus && !chatStatus.ok && (
              <p style={styles.warningText}>
                Chat isn't available yet ({chatStatus.error || "OPENAI_API_KEY not set"}). Add an OpenAI API key to your <code>.env</code> file and restart <code>npm run server</code> (see README).
              </p>
            )}

            <div style={styles.chatWindow}>
              {!chatMessages.length && <p style={styles.small}>No messages yet - try "what's the plan for today?"</p>}
              {chatMessages.map((m, i) => (
                <div key={i} style={m.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant}>
                  {m.content}
                </div>
              ))}
              {chatBusy && <div style={styles.chatBubbleAssistant}>Thinking...</div>}
            </div>
            {chatError && <p style={styles.warningText}>{chatError}</p>}

            <div style={styles.row}>
              <input
                style={styles.inputFull}
                placeholder="e.g. What's today's plan?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                disabled={!!(chatStatus && !chatStatus.ok)}
              />
            </div>
            <button style={styles.primaryButton} onClick={handleSendChat} disabled={chatBusy || (chatStatus && !chatStatus.ok)}>
              {chatBusy ? "Sending..." : "Send"}
            </button>
          </section>
        )}

        {tab === "settings" && (
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Plan settings for {activeProfile.name}</h2>
            <p style={styles.label}>Adventurousness</p>
            <div style={styles.chips}>
              {Object.keys(ADVENTUROUSNESS_PRESETS).map((level) => (
                <button
                  key={level}
                  style={activeProfile.settings.adventurousness === level ? styles.chipActive : styles.chip}
                  onClick={() => applyAdventurousness(level)}
                >
                  {level}
                </button>
              ))}
            </div>
            <p style={styles.small}>Controls how many meal slots per week are used for new-food exposure, and the default variety pace.</p>

            <div style={styles.row}>
              <label style={styles.settingsField}>
                Exposure slots / week
                <input
                  type="number"
                  min="0"
                  style={styles.input}
                  value={activeProfile.settings.exposureTargetPerWeek}
                  onChange={(e) => updateSettings({ exposureTargetPerWeek: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
              <label style={styles.settingsField}>
                Repeat gap (days)
                <input
                  type="number"
                  min="1"
                  style={styles.input}
                  value={activeProfile.settings.repeatGapDays}
                  onChange={(e) => updateSettings({ repeatGapDays: Math.max(1, Number(e.target.value) || 1) })}
                />
              </label>
            </div>

            {activeProfile.log.length > 0 && (
              <>
                <div style={styles.spaceBetween}>
                  <p style={styles.label}>Recent history</p>
                  <button style={styles.smallButton} onClick={clearHistory}>Clear history</button>
                </div>
                {[...activeProfile.log].slice(-10).reverse().map((entry) => {
                  const food = activeProfile.foods.find((f) => f.id === entry.foodId);
                  return (
                    <div key={entry.id} style={styles.changeRow}>
                      <div>
                        <strong>{entry.day} · {entry.slot}</strong>
                        <p>{food ? food.name : "Unknown food"} — {entry.response}</p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
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

        <footer style={styles.footer}>
          <strong>LittleBowl</strong> — Little meals, big growth.<br />
          Goal: safe foods + hidden nutrition + no-pressure exposure. Rejected foods stay in rotation — repetition, not removal, builds acceptance.
        </footer>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 16,
    fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, sans-serif',
    color: "#1e1b4b",
  },
  app: { maxWidth: 520, margin: "0 auto", paddingBottom: 40 },
  brandBar: {
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
    borderRadius: 24,
    padding: "14px 16px",
    marginBottom: 14,
    boxShadow: "0 8px 24px rgba(99, 102, 241, 0.25)",
  },
  brandLockup: { display: "flex", alignItems: "center", gap: 12 },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "#fffaf0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
    objectFit: "cover",
  },
  brandName: { margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 },
  brandLittle: { color: "#e8f5c8" },
  brandBowl: { color: "#ffd4a8" },
  brandTagline: { margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.92)" },
  header: { marginBottom: 14 },
  title: { fontSize: 24, lineHeight: 1.15, margin: 0, fontWeight: 800, color: "#1e1b4b" },
  subtitle: { margin: "6px 0 0", color: "#6b7280", fontSize: 14, lineHeight: 1.45 },
  tipBox: {
    background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    border: "1px solid #fed7aa",
    boxShadow: "0 4px 14px rgba(249, 115, 22, 0.08)",
  },
  tipText: { margin: "6px 0 0", fontSize: 14, color: "#9a3412" },
  tabsWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tab: {
    border: "1px solid #e9d5ff",
    background: "#fff",
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 700,
    color: "#6b7280",
    boxShadow: "0 2px 6px rgba(99, 102, 241, 0.06)",
    fontSize: 13,
    cursor: "pointer",
  },
  activeTab: {
    border: 0,
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 800,
    boxShadow: "0 6px 16px rgba(99, 102, 241, 0.28)",
    fontSize: 13,
    cursor: "pointer",
  },
  card: {
    background: "linear-gradient(135deg, #f3e8ff 0%, #ffffff 100%)",
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
    border: "1px solid #e9d5ff",
    boxShadow: "0 8px 16px rgba(99, 102, 241, 0.1)",
  },
  sectionTitle: { margin: "0 0 10px", fontSize: 18, fontWeight: 800 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 16,
    border: "1px solid #e9d5ff",
    padding: "0 12px",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#fff",
    color: "#1e1b4b",
  },
  inputFull: {
    width: "100%",
    height: 44,
    borderRadius: 16,
    border: "1px solid #e9d5ff",
    padding: "0 12px",
    fontSize: 14,
    marginTop: 8,
    boxSizing: "border-box",
    background: "#fff",
    color: "#1e1b4b",
  },
  textarea: {
    width: "100%",
    minHeight: 70,
    borderRadius: 16,
    border: "1px solid #e9d5ff",
    padding: 12,
    fontSize: 14,
    marginTop: 8,
    boxSizing: "border-box",
    fontFamily: "inherit",
    background: "#fff",
    color: "#1e1b4b",
  },
  primaryButton: {
    width: "100%",
    height: 46,
    marginTop: 8,
    border: 0,
    borderRadius: 18,
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(99, 102, 241, 0.28)",
  },
  daySelect: {
    width: "100%",
    height: 46,
    borderRadius: 18,
    border: "1px solid #e9d5ff",
    padding: "0 12px",
    fontSize: 15,
    marginBottom: 12,
    background: "#fff",
    color: "#1e1b4b",
    fontWeight: 700,
  },
  mealCard: {
    background: "#fff",
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
    border: "1px solid #e9d5ff",
    boxShadow: "0 8px 16px rgba(99, 102, 241, 0.1)",
  },
  label: {
    color: "#f97316",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 12,
    fontWeight: 800,
    margin: "4px 0 6px",
  },
  cardTitle: { margin: "0 0 8px", fontSize: 19, fontWeight: 800, color: "#1e1b4b" },
  nutritionBox: {
    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(74, 222, 128, 0.06) 100%)",
    borderRadius: 16,
    padding: 10,
    fontSize: 14,
    lineHeight: 1.4,
    marginTop: 8,
    color: "#166534",
  },
  small: {
    background: "#faf5ff",
    padding: 10,
    borderRadius: 14,
    fontSize: 13,
    color: "#6b7280",
    marginTop: 8,
  },
  warningText: {
    background: "#fffbeb",
    padding: 10,
    borderRadius: 14,
    fontSize: 13,
    color: "#92400e",
    marginTop: 8,
    border: "1px solid #fde68a",
  },
  safetyAvoid: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 10,
    borderRadius: 14,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 1.4,
  },
  safetyModify: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    padding: 10,
    borderRadius: 14,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 1.4,
  },
  safetyLimit: {
    background: "#fefce8",
    border: "1px solid #fde68a",
    color: "#854d0e",
    padding: 10,
    borderRadius: 14,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 1.4,
  },
  safetyBadgeMini: {
    display: "inline-block",
    marginLeft: 6,
    background: "#fef2f2",
    color: "#991b1b",
    padding: "3px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  chatWindow: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 360,
    overflowY: "auto",
    margin: "10px 0",
    padding: 4,
  },
  chatBubbleUser: {
    alignSelf: "flex-end",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 16,
    fontSize: 14,
    maxWidth: "85%",
  },
  chatBubbleAssistant: {
    alignSelf: "flex-start",
    background: "#f3e8ff",
    color: "#1e1b4b",
    padding: "8px 12px",
    borderRadius: 16,
    fontSize: 14,
    maxWidth: "85%",
    whiteSpace: "pre-wrap",
    border: "1px solid #e9d5ff",
  },
  badge: {
    display: "inline-block",
    background: "#ede9fe",
    color: "#4f46e5",
    padding: "3px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  exposureBadge: {
    display: "inline-block",
    background: "#faf5ff",
    color: "#7e22ce",
    padding: "3px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    marginLeft: 6,
    border: "1px solid #e9d5ff",
  },
  retiredBadge: {
    display: "inline-block",
    background: "#f3e8ff",
    color: "#6b7280",
    padding: "3px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  weekMeal: {
    background: "#faf5ff",
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    border: "1px solid #e9d5ff",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    background: "#f3e8ff",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 600,
    border: "1px solid #e9d5ff",
    color: "#6b7280",
    cursor: "pointer",
  },
  chipActive: {
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
    color: "#fff",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 800,
    border: 0,
    cursor: "pointer",
  },
  spaceBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  smallButton: {
    border: "1px solid #e9d5ff",
    background: "#fff",
    padding: "8px 10px",
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 13,
    color: "#4f46e5",
    cursor: "pointer",
  },
  changeRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    background: "#faf5ff",
    borderRadius: 16,
    padding: 10,
    marginTop: 8,
    border: "1px solid #e9d5ff",
  },
  deleteButton: {
    border: 0,
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 12,
    padding: "8px 10px",
    height: 36,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  footer: { textAlign: "center", color: "#6b7280", fontSize: 13, padding: "16px 8px" },
  profileActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  responseRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 },
  responseButton: {
    border: "1px solid #e9d5ff",
    background: "#faf5ff",
    padding: "8px 12px",
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 13,
    color: "#1e1b4b",
    cursor: "pointer",
  },
  foodRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
    background: "#faf5ff",
    borderRadius: 16,
    padding: 10,
    marginTop: 8,
    border: "1px solid #e9d5ff",
  },
  settingsField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    fontWeight: 700,
    color: "#6b7280",
  },
};
