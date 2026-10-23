# Performance & UX Fixes (September 2026)

This document lists all performance and meal-reminder fixes applied to the LittleBowl mobile app.

---

## Meal reminders — system settings popup

**Problem:** Android needs Notifications, Alarms & reminders, and unrestricted battery for on-time alerts. The old save dialog only mentioned these in small text.

**Fix:**
- Added `MealReminderSetupModal` — a checklist popup after saving reminders (and after enabling from Home).
- Each row opens the correct system screen: Notifications, Alarms & reminders, Battery.
- Status refreshes when you return from Settings (✓ / ○ updates).
- Blocked-permission flow uses `showMealReminderBlockedAlert()` with direct links.

**Files:** `src/components/MealReminderSetupModal.tsx`, `src/notifications.ts`, `app/account.tsx`, `src/components/NotificationPromptCard.tsx`

---

## 1. Save reminders slow

**Problem:** Scheduling ~35 meal alarms ran one at a time.

**Fix:** `scheduleMealAlarm` calls now run in parallel via `Promise.all` in `rescheduleMealReminders()`.

**Files:** `src/notifications.ts`

---

## 2. Foreground reminder resync too often

**Problem:** Every time the app returned to foreground, all alarms were cancelled and rescheduled.

**Fix:** Debounced to at most once per hour (`REMINDER_SYNC_MIN_INTERVAL_MS = 3600000`).

**Files:** `src/notifications.ts`

---

## 3. Cold start blocked by alarm setup

**Problem:** On launch, `_layout.tsx` rescheduled all reminders before the UI was ready.

**Fix:** Reminder reschedule deferred by 2.5 seconds after fonts load so Home can paint first.

**Files:** `app/_layout.tsx`

---

## 4. Home tab reload on every visit

**Problem:** Switching to Home always showed a loading spinner and refetched 5 APIs.

**Fix:**
- In-memory cache with 60s TTL (`screenCache.ts`).
- Stale-while-revalidate: show last data instantly, refresh in background when stale.
- Dashboard JSON persisted to AsyncStorage for faster cold start on Home.
- Pull-to-refresh and meal log changes force a fresh fetch.
- `invalidateToddlerMealData()` clears home/dashboard/nutrition cache after logging.

**Files:** `src/screenCache.ts`, `app/(tabs)/dashboard.tsx`

---

## 5. Log tab — duplicate dashboard fetch

**Problem:** Log called `api.dashboard()` on every focus even when Home had just loaded it.

**Fix:** Log reads from the shared `dashboard` cache; only hits the network when cache is missing or stale.

**Files:** `app/(tabs)/log.tsx`, `src/screenCache.ts`

---

## 6. Food search — API on every keystroke

**Problem:** Each character after 2 letters triggered `/api/foods`.

**Fix:** 300ms debounce on the search field; spinner only while a debounced request is in flight.

**Files:** `app/(tabs)/log.tsx`

---

## 7. Plan — “Make a new plan” felt like a blank screen

**Problem:** Regenerate set global `loading=true`, hiding the current plan.

**Fix:**
- Keep existing plan visible while regenerating; button shows “Making a new plan...”.
- Weekly plan cached 60s; stale plan shown immediately on tab switch.
- Pull-to-refresh busts cache and refetches.

**Files:** `app/(tabs)/plan.tsx`

---

## 8. Nutrition / Recipes / Preferences / Cookbook / Growth — full reload every visit

**Problem:** Each screen cleared UI and refetched on every `useFocusEffect`.

**Fix:** Stale-while-revalidate with screen-specific TTLs (60–120s). Loading spinner only when there is no cached data.

**Files:**
- `app/(tabs)/nutrition.tsx`
- `app/recipes.tsx`
- `app/preferences.tsx`
- `app/cookbook.tsx`
- `app/growth.tsx`

---

## 9. Cache invalidation after meal changes

**Problem:** Cached nutrition/home data could be stale after logging a meal.

**Fix:** `invalidateToddlerMealData(toddlerRef)` called after log, edit, delete, and quick-log on Home.

**Files:** `src/screenCache.ts`, `app/(tabs)/log.tsx`, `app/(tabs)/dashboard.tsx`

---

## 10. Bottom tab taps hard to hit

**Problem:** Tab bar targets were small on some Android devices.

**Fix:** Custom `tabBarButton` with `hitSlop` (12px vertical, 8px horizontal).

**Files:** `app/(tabs)/_layout.tsx`

---

## 11. Chat — slow perceived response

**Problem:** LLM replies take several seconds (server-bound); list did not scroll when sending.

**Fix:** Auto-scroll to bottom when a message is sent so “Thinking…” is visible immediately. (Streaming replies would need a backend change and is not included here.)

**Files:** `app/chat.tsx`

---

## New shared module

| File | Purpose |
|------|---------|
| `src/screenCache.ts` | TTL memory cache, dashboard disk persistence, meal-data invalidation |

---

## How to verify

1. Reload the app (Metro `r` or rebuild).
2. **Home:** Open Home twice within 60s — second visit should not flash a full-screen loader.
3. **Log → Search:** Type quickly — network calls should batch, not fire per letter.
4. **Save reminders:** Modal should list Notifications, Alarms & reminders, and Battery.
5. **Plan:** Tap “Make a new plan” — old week stays visible until the new one arrives.
6. **Tabs:** Bottom navigation should feel easier to tap.

---

## Not changed (requires backend or larger work)

- **Chat streaming** — needs SSE/WebSocket from API; UI already shows “Thinking…”.
- **Plan regenerate speed** — server-side generation time; UI now keeps old plan visible during wait.

---

## Regression fixes during QA (Sep 4, 2026)

| Issue | Fix |
|-------|-----|
| Recipes search re-fetched on every keystroke via `useFocusEffect([load, q])` | Removed `q` from focus effect; added 300ms debounced search |
| Plan `load` re-created when `plan` state changed, re-triggering focus loads | Removed `plan` from deps; use `getStale(key)` for loading check |
| Account food preferences refetched every visit | Reuses `preferences` screen cache (120s TTL) |
| Weaning screen full reload every visit | Added stale-while-revalidate cache |

---

## QA test results (Sep 4, 2026)

### Static checks
- `npm run typecheck` — **PASS**

### API smoke
- `GET /api/foods?q=rice` — **200** (~150–440ms)
- `GET /api/recipes` — **200** (~150ms)

### Device (Samsung Galaxy M51)
| Test | Result | Notes |
|------|--------|-------|
| Cold launch → Home dashboard | **PASS** | Greeting, meals, nutrition render |
| Meal reminders at set time | **PASS** | Evening snack at 15:48 (earlier session) |
| Save reminders setup modal | **PASS** | Notifications + Alarms buttons (earlier session) |
| Tab navigation automation | **Blocked** | Lock screen / USB dialog interrupted automated taps |
| Dev build after force-stop | **Needs Metro** | Run `adb reverse tcp:8081 tcp:8081` |

### Remaining performance opportunities
| Area | Issue | Status |
|------|-------|--------|
| `recipe/[slug].tsx` | Loads recipe on every open | **Fixed** — 10 min stale-while-revalidate cache |
| Photo meal log | Image upload slow | **Fixed** — resize to 1280px + JPEG 0.6 + progress stages |
| Auth cold start | `api.status()` blocks routing | **Fixed** — hydrate from AsyncStorage, refresh in background |
| Chat | 3–10s LLM latency | Backend streaming (future) |

---

## Additional fixes (Sep 4, evening)

| Fix | Files |
|-----|-------|
| Recipe detail cache (10 min TTL) | `src/screenCache.ts`, `app/recipe/[slug].tsx` |
| Photo compress before upload | `src/compressMealPhoto.ts`, `app/(tabs)/log.tsx` |
| Session cache for instant startup | `src/storage.ts`, `src/AuthContext.tsx` |

---

## Cold start & dev launcher (Sep 5, 2026)

**Problem:** Dev client showed Development Build → Connect → Bundling → Dev menu → Continue before the app. Splash hid before auth was ready. Chat FAB overlapped the More tab.

**Fix:**
- Correct `expo-dev-client` plugin config in `app.json` (config must be `["expo-dev-client", { … }]`, not a bare object).
- Native flags: `skipOnboarding: true`, `showMenuAtLaunch: false`, `launchMode: most-recent`, `defaultLaunchURL: http://127.0.0.1:8081`.
- `StartupGate` hides splash only when fonts + auth `ready`.
- `app/index.tsx` returns `null` while auth loads (splash stays up).
- Defer `syncRemindersFromToddler` on session apply (non-blocking).
- Move `ChatFab` to bottom-left so More tab stays tappable.

**Files:** `app.json`, `app/_layout.tsx`, `src/StartupGate.tsx`, `app/index.tsx`, `src/AuthContext.tsx`, `src/components/ChatFab.tsx`

**Rebuild required:** `npx expo prebuild --platform android` then `gradlew app:assembleDebug` / install APK for dev-client native flags.

**Dev note:** First load still downloads the JS bundle from Metro (~15–30s). Production builds avoid this. Warm starts reuse Metro cache (~3–4s to tabs).

