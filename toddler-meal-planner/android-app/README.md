# LittleBowl native apps (Android + iOS)

Official LittleBowl apps for **http://littlebowl.in** — Capacitor + native
chrome (splash, status bar, notifications, camera, back button).

There is **no server-URL setup screen**. The app opens the **product** entry
(`/home` → dashboard or onboarding), not the marketing website.

| | Android | iOS |
|--|---------|-----|
| Package / Bundle | `com.littlebowl.app` | `com.littlebowl.app` |
| Opens | `http://littlebowl.in/home` | `http://littlebowl.in/home` |
| Project | `android/` | `ios/App/App.xcworkspace` |
| Notifications | Local Notifications | Local Notifications |

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
npm run open:android          # Android Studio → Run ▶
# or
npm run build:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## iOS (Mac)

```bash
npm run sync:ios
cd ios/App && pod install && cd ../..
npm run open:ios              # Signing → Team → Run
```

## What “native” means here

- Branded splash + status bar
- Hardware back (Android) → history / minimize
- Local meal + nutrition notifications (on by default)
- Camera / photos for meal logging
- Safe-area layout; PWA “Add to Home Screen” prompts hidden in-app
- External links leave the app; LittleBowl stays in-app
- Opens `/home` (same as PWA `start_url`) — never the marketing landing page

The UI is still the LittleBowl product UI (same screens as the web app). That is
intentional: one product, one backend, store-ready apps. A full Swift/Kotlin UI
rewrite would duplicate every screen — not required for App Store / Play.

## Change production URL (rare)

```bash
npm run configure -- https://littlebowl.in/home   # when you enable HTTPS
npm run sync
```

Bare origins are normalized to `/home` automatically.

## Notifications

- Dashboard requests permission and schedules meal reminders
- **My Account → Notifications** — times, toggles, **Send test**
- No FCM/APNs required for local alerts

## Store release

Bump versions before shipping:

- Android: `android/app/build.gradle` → `versionCode` / `versionName`
- iOS: Marketing Version / Current Project Version in Xcode

Prefer **https://littlebowl.in** when TLS is ready (cookies + App Review are happier on HTTPS). Until then HTTP is allowed via cleartext + ATS exception for `littlebowl.in`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank screen | Confirm http://littlebowl.in/home opens in Chrome/Safari on the phone |
| Lands on marketing page | Rebuild with `server.url` = `…/home`; landing also redirects Capacitor → `/home` |
| iOS HTTP blocked | Rebuild after Info.plist ATS exception for littlebowl.in |
| Notifications silent | Settings → LittleBowl → Allow Notifications; use Send test |
| CocoaPods | `sudo gem install cocoapods` then `pod install` in `ios/App` |
