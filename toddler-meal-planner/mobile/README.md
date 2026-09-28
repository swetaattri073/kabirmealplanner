# LittleBowl native app (Expo)

Complete **Android + iOS** client for LittleBowl. This is a native React Native
app that talks to the same JSON APIs as the website — it does **not** embed or
render `https://littlebowl.in` in a WebView.

| | |
|---|---|
| Package / bundle ID | `com.littlebowl.app` |
| Version | `1.0.0` (`ios.buildNumber` / `android.versionCode` = `1`) |
| API base URL | `https://littlebowl.in` |
| Privacy policy | `https://littlebowl.in/privacy` |

The legacy Capacitor WebView shell remains under `../android-app/` for
reference only. Prefer this `mobile/` project for store builds.

## Features (parity with parent app)

- Marketing / welcome stories → register, sign in, or guest onboarding
- Dashboard, log meal (search + smart text + camera), weekly plan, nutrition
- Preferences, recipes, chat assistant, My Account
- Meal reminders (local notifications, editable times)
- Session: Bearer token in SecureStore + guest id for anonymous toddlers

Admin (`/admin`) is web-only and unchanged.

## Prerequisites

- Node.js 18+
- **iOS (Mac):** Xcode 16+ from the Mac App Store, CocoaPods (`sudo gem install cocoapods` or via Homebrew), a free or paid Apple ID in Xcode
- **Android:** Android Studio + emulator/device + JDK 17

```bash
cd toddler-meal-planner/mobile
npm install
```

## Test on a physical iPhone (Mac)

Use a **development build** (not Expo Go) so camera and local meal reminders work.

### 1. One-time Mac / Apple setup

1. Install **Xcode** → open it once → accept license → install extra components.
2. Xcode → **Settings → Platforms** → install a recent **iOS** platform.
3. Xcode → **Settings → Accounts** → add your Apple ID.
4. On the iPhone: **Settings → Privacy & Security → Developer Mode** → On (iOS 16+), then reboot if asked.
5. Connect iPhone with USB (or pair wirelessly after first trust). Unlock the phone and tap **Trust**.

### 2. Generate the native `ios/` project

```bash
cd toddler-meal-planner/mobile
npm install
npm run ios:prebuild
# first time or after native config changes:
# npm run ios:prebuild:clean
```

### 3. Install on your iPhone

**Easiest (CLI):**

```bash
npm run ios:device
```

When prompted, pick your iPhone. First run may ask for a **Development Team** — choose your personal team (free) or paid Apple Developer team.

**Or via Xcode:**

```bash
open ios/LittleBowl.xcworkspace
# if the name differs: open ios/*.xcworkspace
```

1. Top bar: select your **iPhone** as the run destination (not a simulator).
2. Target **LittleBowl** → **Signing & Capabilities** → Team = your Apple ID / team.  
   Xcode will create a development provisioning profile for `com.littlebowl.app`.
3. Press **Run** (▶).

### 4. First launch on device

If iOS blocks an untrusted developer app:

**Settings → General → VPN & Device Management** → your developer app → **Trust**.

Then reopen LittleBowl. Confirm it loads data from `https://littlebowl.in` (login, guest onboarding, weekly plan, log meal, camera, reminders).

### 5. Hot reload while developing

With the app already installed from step 3:

```bash
npx expo start
```

Shake the phone (or use the dev menu) to reload. **Native** changes (permissions, icons, plugins) still need another `ios:prebuild` + `ios:device` / Xcode run.

### Common iPhone install issues

| Problem | Fix |
|--------|-----|
| No devices listed | Unlock iPhone, trust computer, enable Developer Mode |
| Signing error / bundle ID | Set Team in Xcode; free accounts expire profiles ~7 days — re-run |
| `pod install` fails | `cd ios && pod install --repo-update` then retry |
| App can’t reach API | Phone needs internet; server must allow HTTPS `https://littlebowl.in` |
| Notifications silent | Allow notifications when prompted; check **Settings → LittleBowl → Notifications** |

## Expo Go vs development build

**Expo Go** is fine for quick UI checks, but meal reminders / some native modules need a **dev or production build** (`expo run:ios` / `expo run:android`).

### Meal reminder icons (Android)

Collapsed tray icons and the large brand mark are **native build** settings.
After changing notification assets or `plugins/withAndroidNotificationLargeIcon`, rebuild Android (`expo prebuild --platform android --clean` then `expo run:android`).

## App Store / Play Store builds

### iOS (App Store) — from your Mac

1. Paid [Apple Developer Program](https://developer.apple.com/programs/) membership.
2. App Store Connect → create app with bundle ID **`com.littlebowl.app`**.
3. Privacy URL: `https://littlebowl.in/privacy`.
4. Bump `ios.buildNumber` in `app.json` before every upload (start at `"1"`).
5. Archive and upload:

```bash
cd toddler-meal-planner/mobile
npm run ios:prebuild:clean
open ios/*.xcworkspace
```

In Xcode: any **iOS Device** destination → **Product → Archive** → **Distribute App → App Store Connect**.

Or cloud:

```bash
npx eas-cli login
npx eas init          # replaces placeholder projectId in app.json
npx eas build -p ios --profile production
npx eas submit -p ios --latest
```

6. TestFlight → install on iPhone → then submit for App Review.

### Android (Play Store)

```bash
npx expo prebuild --platform android
# open android/ in Android Studio, generate signed AAB
# or: eas build -p android --profile production
```

Bump `android.versionCode` before each Play upload.

## Auth

Native clients use:

```http
Authorization: Bearer <token>
X-Guest-Id: <guest_id>
```

Endpoints: `POST /api/auth/signup`, `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/status`.

Website cookie sessions and HTML auth pages are unchanged.
