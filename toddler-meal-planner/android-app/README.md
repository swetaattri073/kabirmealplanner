# LittleBowl Android app

Native Android app for LittleBowl, built with
[Capacitor](https://capacitorjs.com/).

On first launch the app asks for your **LittleBowl server URL**, saves it, then
opens the full web app (login, meal logs, nutrition, plans) inside a native
WebView — same backend as your Docker/VPS deploy.

## Prerequisites

- Node.js 18+
- [Android Studio](https://developer.android.com/studio) (SDK + emulator or USB device)
- A running LittleBowl server (your VPS IP or HTTPS domain)

## Quick start

```bash
cd toddler-meal-planner/android-app
npm install
npm run sync
npm run open          # Android Studio → Run ▶
```

Or build an APK from the command line:

```bash
npm run sync
npm run build:debug
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### First launch on the phone

1. Open **LittleBowl**
2. Enter your server address, e.g. `http://203.0.113.10` or `https://meals.example.com`
3. Tap **Open LittleBowl**

To change the server later: clear app storage, or open the setup screen again by
uninstalling/reinstalling, or (advanced) visit the setup asset with `?setup=1`
after resetting.

### Optional: bake a default URL into the APK

```bash
npm run configure -- https://YOUR_DOMAIN
npm run sync
npm run build:debug
```

That prefills the field; users can still override it on device.

## Notifications

The Android app can remind you to **log meals** and surface **nutrition alerts**:

- Open **My Account → Notifications** (or visit `/profile#notifications`)
- Enable meal reminders and/or nutrition alerts
- Adjust reminder times (defaults: 8:00 breakfast … 19:00 dinner)
- Allow notification permission when Android asks

Meal reminder taps open Log Meal for that slot. Nutrition alert taps open the Nutrition alerts section.

Reminders are scheduled on-device (Capacitor Local Notifications). Alert notices are sent when the Dashboard or Nutrition page loads and finds a new warning/critical alert (at most once per day per alert).

## What this app includes

| Piece | Detail |
|-------|--------|
| Package ID | `com.littlebowl.app` |
| Launcher name | LittleBowl |
| Permissions | Internet, camera (optional) for meal photos |
| Splash / theme | Cream + green LittleBowl branding |
| Backend | Your existing Flask server |

## Updating after web changes

Redeploy the Flask app as usual. The Android app picks up UI/API changes on the
next open — **no APK rebuild** needed for normal website updates.

Rebuild the APK only when you change icons, permissions, package id, or the
baked default URL.

Bump version in `android/app/build.gradle`:

```gradle
versionCode 2
versionName "1.1.0"
```

## Play Store (release)

1. Create a keystore and configure signing in Android Studio
2. Build → Generate Signed Bundle / APK (or `npm run build:release`)
3. Upload to Google Play Console

Prefer **HTTPS** in production for reliable cookies/sessions.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Can’t reach server | Phone and server must be on reachable network; try the same URL in Chrome |
| Cleartext / HTTP blocked | HTTP is allowed in this app; confirm the IP and port |
| Camera upload fails | Grant camera / photos when prompted |
| Want to change server | Clear app data, or reinstall, then enter the new URL |

## Project layout

```
android-app/
  www/                 # first-launch setup + redirect
  android/             # Android Studio project
  scripts/configure-server.js
  capacitor.config.json
```
