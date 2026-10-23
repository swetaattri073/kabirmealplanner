# LittleBowl device test log — Sep 5, 2026

Device: Samsung Galaxy M51 (RZ8N92081FF) · Dev client `com.littlebowl.app` · Metro `127.0.0.1:8081`

---

## Cold start fixes (this session)

| Change | Status |
|--------|--------|
| Fix invalid `expo-dev-client` plugin array in `app.json` | ✅ prebuild succeeds |
| Native rebuild + APK install (`skipOnboarding`, `showMenuAtLaunch: false`) | ✅ installed |
| `StartupGate` — splash until fonts + auth ready | ✅ JS live |
| Defer reminder sync on `applySession` | ✅ JS live |
| Move chat FAB to bottom-left (was blocking More tab) | ✅ JS live |

**Observed after new APK:** Relaunch goes straight to bundling/dashboard — no manual dev-launcher Connect step when Metro is up.

**Cold start timing (dev build, force-stop):** ~124s to first UI in one automated run (includes Metro bundle + uiautomator polling overhead). Warm navigation after bundle: ~3–4s acceptable.

---

## Profiles on account (`babitaattri4@gmail.com`)

| Name | Age | Diet | Status |
|------|-----|------|--------|
| Kk | 59 mo | Eggetarian, milk allergy | ✅ tested |
| Mira | 6 mo | Vegetarian, moderate | ✅ created (API) + device switch confirmed |
| Arjun | 10 mo | Non-veg, high activity | ✅ created (API); visible on More switcher |

Multi-child switcher on More shows all 3 profiles. Switch to Mira confirmed via device.

---

## Workflow tests — Kk (59 months)

| Screen / flow | Status | Notes |
|---------------|--------|-------|
| Home dashboard | ✅ | Greeting, meal cards, 0/5 meals |
| Log tab | ✅ | Portion buttons, emoji reactions, meal-type tabs |
| Plan tab | ✅ | Deep link `littlebowl://plan` — weekly plan |
| Nutrition tab | ✅ | Deep link `littlebowl://nutrition` |
| More menu | ✅ | Cookbook, Growth, Preferences, Recipes, Account, Add child |
| My account | ✅ | Profile, toddler stats, Sign out |
| Sign out | ✅ | → Welcome carousel |
| Sign in | ✅ | `babitaattri4@gmail.com` + password → dashboard restores 3 children |
| Weaning | N/A | Correctly hidden (age > 12 mo) |

---

## Workflow tests — Mira (6 months)

| Screen / flow | Status | Notes |
|---------------|--------|-------|
| Profile switch | ✅ | More → tap Mira → dashboard shows "Mira · 6 months" |
| Home — Starting solids banner | ✅ | "First tastes guide", Ragi Porridge next, 0/8 foods |
| Meals today count | ✅ | 0/2 (age-appropriate schedule) |
| More — Starting solids menu | ✅ | Appears for age < 12 mo (hidden for Kk) |
| Starting solids detail | ✅ | Step 1 guide, first foods checklist, "Tried it" buttons |
| Plan / Log / Nutrition | ⏳ | Deep links work; spot-check after switch |

---

## Workflow tests — Arjun (10 months)

| Screen / flow | Status | Notes |
|---------------|--------|-------|
| Profile on More switcher | ✅ | Listed as "Arjun · 10 months old" |
| Home after switch | ⏳ | Automation tap overlaps Starting solids link; switch manually |
| Starting solids (expected) | ⏳ | Should match Mira (age < 12 mo) |

---

## Onboarding fix (this session)

Sticky footer for "Start planning" button + `testID="onboarding-submit"` + safe-area padding. Profiles were created via API instead (`scripts/create_test_profiles.ps1`).

---

## Auth flow tests

| Flow | Status |
|------|--------|
| Sign out → Welcome | ✅ |
| Sign in → dashboard + 3 children | ✅ |
| Continue as guest → onboarding path | ✅ |

**Sign-in automation note:** Use mobile MCP for email, adb `input text` for password, KEYCODE_BACK to dismiss keyboard, then tap Sign in — avoids Samsung keyboard settings opening.

---

## Workflow tests — Mira / Arjun (pending profiles)

| Flow | Status |
|------|--------|
| Starting solids (6–12 mo) | ✅ Mira — banner + detail screen |
| Age-specific meal plans | ✅ Mira 0/2 meals vs Kk 0/5 |
| Multi-child switch on More | ✅ 3 profiles; Mira switch confirmed |

---

## Down syndrome / cognitive accessibility (partial)

### What works well
- **Large tap targets** on Log: portion grid and emoji reactions are easy to hit.
- **Plain language** on Log ("A little", "Half", "Most") alongside percentages.
- **Clear hierarchy** on Home: greeting → summary cards → today's meals.
- **Consistent purple accent** for primary actions (Log buttons).

### Friction / improvements
- **Chat FAB overlapped More tab** (bottom-right) — fixed by moving FAB to bottom-left.
- **Dev cold start** still shows white/bundling screen — production build + session cache will feel faster; splash gate reduces "empty flash" after bundle.
- **Dashboard information density** is moderate-high (stats + nutrition + 5 meals); consider collapsible sections for lower cognitive load.
- **Small links** ("Details →", "See all →") are harder targets than meal Log buttons.
- **Keyboard on Log** can cover tab bar when notes field focused — dismiss keyboard before switching tabs.
- **Tab bar vs system nav** overlap on this device makes automated taps hit wrong targets; ensure tab hitSlop remains generous (already 12px).

### First impression (dev build)
- After bundle: friendly "Good afternoon, Sweta!" — positive.
- 0% nutrition before logging is clear but may feel empty; alert explains "log 3 days" — good guidance.

---

## Next manual steps on phone

1. On **More**, tap **Arjun** to confirm 10 mo dashboard (automation kept hitting Starting solids link below).
2. Spot-check **Plan** and **Log** for Mira vs Kk (meal count / weaning content).
3. Optional: re-test cold start after force-stop.
