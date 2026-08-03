# LittleBowl native apps (Android + iOS)

Official LittleBowl apps for **http://littlebowl.in** — Capacitor + native
chrome (splash, status bar, notifications, camera).

There is **no server-URL setup screen**. The app opens `/home`, which restores
the local session and either shows the **dashboard** (returning users) or the
**horizontal marketing / registration** carousel (first open).

| | Android | iOS |
|--|---------|-----|
| Package / Bundle | `com.littlebowl.app` | `com.littlebowl.app` |
| Opens | `http://littlebowl.in/home` | `http://littlebowl.in/home` |
| Project | `android/` | `ios/App/App.xcworkspace` |
| Notifications | Local meal reminders | Local meal reminders |

## Prerequisites

- Node.js 18+
- **Android:** Android Studio (SDK + device/emulator)
- **iOS:** macOS + Xcode 15+, CocoaPods, Apple Developer team

```bash
cd toddler-meal-planner/android-app
npm install
npm run sync
npm run verify
npm run verify:ios
```

## Android

```bash
npm run sync:android
npm run open:android
# or
npm run build:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## iOS (Mac)

```bash
npm run sync:ios
cd ios/App && pod install && cd ../..
npm run open:ios
```

## First-open vs return

1. **First open** → marketing stories (swipe right) + Create account / Sign in on the first slide (native).
2. **After register or sign in** → details are in the DB and cached on-device (localStorage + Capacitor Preferences).
3. **Next open** → `/home` restores session → dashboard.

## Meal reminders

On by default. Change times in **My Account → Meal reminders** or **Food Preferences**.

Prefer **https://littlebowl.in** when TLS is ready.
