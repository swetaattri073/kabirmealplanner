# LittleBowl Android app

Native Android shell for the LittleBowl Flask web app, built with
[Capacitor](https://capacitorjs.com/). The app is a full-screen WebView that
loads your **deployed** LittleBowl server (same UI, login, meal logs, nutrition).

## Prerequisites

- Node.js 18+
- [Android Studio](https://developer.android.com/studio) (includes Android SDK + emulator)
- A running LittleBowl server URL (HTTPS preferred; HTTP IP works for local testing)

## One-time setup

```bash
cd toddler-meal-planner/android-app
npm install

# Point the app at your live server (VPS / Render / etc.)
npm run configure -- https://YOUR_DOMAIN_OR_IP

# Sync config + plugins into the Android project
npm run sync
```

Examples:

```bash
# Production domain
npm run configure -- https://meals.example.com

# Local Docker / VPS over HTTP (cleartext enabled)
npm run configure -- http://192.168.1.20
```

## Build & run

### Option A — Android Studio (recommended)

```bash
npm run open
# or: npx cap open android
```

Then in Android Studio:

1. Wait for Gradle sync
2. Pick an emulator or USB device (enable Developer options + USB debugging)
3. Click **Run** ▶

### Option B — command line APK

```bash
npm run sync
npm run build:debug
```

Debug APK path:

`android/app/build/outputs/apk/debug/app-debug.apk`

Install on a phone:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## What this app includes

| Piece | Detail |
|-------|--------|
| Package ID | `com.littlebowl.app` |
| Launcher name | LittleBowl |
| Permissions | Internet, camera (optional) for meal photos |
| Splash / theme | Cream + green LittleBowl branding |
| Backend | Your existing Flask API + templates |

Meal logging, nutrition, plans, and auth all stay on the server — no second database.

## Updating after web changes

Redeploy the Flask app as usual. The Android shell picks up UI/API changes on
next launch (no APK rebuild needed for normal web updates).

Rebuild the APK only when you change:

- Server URL (`npm run configure` + `npm run sync`)
- Capacitor plugins / native permissions
- App icons, package id, or version

Bump version in `android/app/build.gradle`:

```gradle
versionCode 2
versionName "1.1"
```

## Play Store (release)

1. Create a keystore and configure signing in Android Studio
2. `npm run build:release` (or Build → Generate Signed Bundle / APK)
3. Upload the AAB/APK to Google Play Console

Use HTTPS for production so cookies / sessions work reliably on Android.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Splash / “set your server URL” page | Run `npm run configure -- https://…` then `npm run sync` |
| Blank / ERR_CLEARTEXT | For HTTP hosts, cleartext is already enabled; confirm the phone can reach the IP |
| Camera upload fails | Grant camera / photos permission when prompted |
| Login cookie issues | Prefer HTTPS; avoid mixing `http://IP` and a domain |

## Project layout

```
android-app/
  capacitor.config.json   # app id + server.url
  scripts/configure-server.js
  www/                    # offline fallback page
  android/                # Android Studio project
```
