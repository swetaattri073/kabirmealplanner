# LittleBowl mobile apps (Android + iOS)

Native apps for LittleBowl, built with [Capacitor](https://capacitorjs.com/).

On first launch the app asks for your **LittleBowl server URL**, saves it, then
opens the full web app (login, meal logs, nutrition, plans) inside a native
WebView — same backend as your Docker/VPS deploy.

| | Android | iOS |
|--|---------|-----|
| Package / Bundle | `com.littlebowl.app` | `com.littlebowl.app` |
| Project | `android/` | `ios/App/App.xcworkspace` |
| Notifications | Local Notifications + channels | Local Notifications (UNUserNotificationCenter) |
| Build machine | Linux/macOS + Android Studio | **macOS + Xcode 15+** |

## Prerequisites

- Node.js 18+
- A running LittleBowl server (HTTPS domain preferred; HTTP LAN/VPS IP works for testing)
- **Android:** [Android Studio](https://developer.android.com/studio) (SDK + emulator or USB device)
- **iOS:** macOS with Xcode 15+, CocoaPods (`sudo gem install cocoapods`), Apple Developer account for device/TestFlight

```bash
cd toddler-meal-planner/android-app
npm install
npm run sync          # syncs www + plugins to android/ and ios/
npm run verify:ios    # Info.plist / PrivacyInfo security checks
```

---

## Android — quick start

```bash
npm run sync:android
npm run open:android          # Android Studio → Run ▶
# or
npm run build:debug
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## iOS — quick start (Mac required)

```bash
npm run sync:ios
cd ios/App && pod install && cd ../..
npm run open:ios              # opens App.xcworkspace in Xcode
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → your Team  
2. Choose a simulator or connected iPhone  
3. Product → Run (▶)

Archive for TestFlight / App Store: Product → Archive → Distribute App.

### iOS security / App Store checklist (already in this repo)

| Check | Where |
|-------|--------|
| Camera usage string | `ios/App/App/Info.plist` → `NSCameraUsageDescription` |
| Photo library strings | `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` |
| ATS (HTTP WebView + LAN) | `NSAllowsArbitraryLoadsInWebContent` + `NSAllowsLocalNetworking` |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` |
| Privacy Manifest | `ios/App/App/PrivacyInfo.xcprivacy` (UserDefaults CA92.1, etc.) |
| No remote push / no unused background modes | Local notifications only |
| Bundle id | `com.littlebowl.app` |
| App icon 1024 | `Assets.xcassets/AppIcon.appiconset` |

Run anytime:

```bash
npm run verify:ios
```

Prefer **HTTPS** in production so cookies/sessions and ATS stay simple.

---

## First launch (both platforms)

1. Open **LittleBowl**
2. Enter your server address, e.g. `https://meals.example.com` or `http://203.0.113.10`
3. Tap **Open LittleBowl**

To change the server later: clear app storage / delete & reinstall.

### Optional: bake a default URL

```bash
npm run configure -- https://YOUR_DOMAIN
npm run sync
```

That prefills the field; users can still override it on device.

---

## Notifications (Android + iOS)

Notifications are **on by default** (meal reminders + nutrition alerts).

- Open **Dashboard** → allow permission when prompted (schedules daily meal reminders)
- **My Account → Notifications** → review times, toggle types, **Send test**
- Tap a meal reminder → opens Log Meal for that slot
- Nutrition alerts fire when the dashboard reports critical/warning gaps

Native stack: `@capacitor/local-notifications` (no APNs / FCM required for local alerts).

Sandbox checks (Flask on `:5000`):

```bash
node scripts/test-notifications.js   # if present under scripts/
cd ../scripts && npm install
BASE_URL=http://127.0.0.1:5000 npm run sandbox:notify
```

---

## Updating after web changes

Redeploy the Flask app as usual. The native apps pick up UI/API changes on the
next open — **no rebuild** needed for normal website updates.

Rebuild only when you change icons, permissions, Info.plist, package id, or the
baked default URL.

Bump versions:

- Android: `android/app/build.gradle` → `versionCode` / `versionName`
- iOS: Xcode target → Marketing Version / Current Project Version  
  (currently **1.1.0** / **2**)

---

## Store release

### Google Play

1. Create a keystore; configure signing in Android Studio  
2. `npm run build:release` or Generate Signed Bundle  
3. Upload to Play Console  

### App Store / TestFlight

1. On a Mac: `npm run sync:ios` → `pod install` → open workspace  
2. Archive with your Distribution certificate + App Store provisioning profile  
3. Upload via Organizer / Transporter  
4. App Privacy: LittleBowl does **not** track users; server URL + notify prefs stay on-device (UserDefaults)  
5. Answer export compliance: uses only exempt encryption (HTTPS) — plist flag set  

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Can’t reach server | Same URL must open in Safari/Chrome on the device; check VPS firewall |
| iOS HTTP blocked | ATS allows WebView cleartext; still prefer HTTPS |
| Camera / photo denied | Grant Camera & Photos when prompted; strings are in Info.plist |
| Notifications silent on iOS | Allow notifications in iOS Settings → LittleBowl; use **Send test** |
| Change server URL | Clear app data / reinstall |
| CocoaPods missing | `sudo gem install cocoapods` then `cd ios/App && pod install` |

## Project layout

```
android-app/
  www/                 # first-launch setup + redirect (shared)
  android/             # Android Studio project
  ios/                 # Xcode / CocoaPods project
  scripts/configure-server.js
  scripts/verify-ios-security.js
  capacitor.config.json
```
