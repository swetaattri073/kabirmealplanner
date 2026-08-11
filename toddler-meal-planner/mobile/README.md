# LittleBowl native app (Expo)

Complete **Android + iOS** client for LittleBowl. This is a native React Native
app that talks to the same JSON APIs as the website — it does **not** embed or
render `https://littlebowl.in` in a WebView.

Package / bundle ID: `com.littlebowl.app`  
API base URL (default): `https://littlebowl.in`

The legacy Capacitor WebView shell remains under `../android-app/` for
reference only. Prefer this `mobile/` project for store builds.

## Features (parity with parent app)

- Marketing / welcome stories → register, sign in, or guest onboarding
- Dashboard, log meal (search + smart text + camera), weekly plan, nutrition
- Preferences, recipes, chat assistant, My Account
- Meal reminders (local notifications, editable times)
- Session: Bearer token in SecureStore + guest id for anonymous toddlers

Admin (`/admin`) is web-only and unchanged.

## Expo Go vs development build

**Expo Go** (QR code) is fine for quick UI checks, but on recent Expo SDKs
Android notifications are **not** supported there and may log an error.

For a real device/emulator build (notifications + camera like production):

```bash
# Emulator running in Android Studio, OR phone with USB debugging
npx expo run:android
```

That generates `android/`, compiles, and installs **LittleBowl** (not Expo Go).

Store / cloud builds: `eas build -p android` (see below).

## Store builds

### Android (Play Store)

```bash
npx expo prebuild --platform android
# open android/ in Android Studio, generate signed AAB
# or: eas build -p android  (if using EAS)
```

### iOS (App Store)

```bash
npx expo prebuild --platform ios
# open ios/*.xcworkspace in Xcode → Archive → TestFlight / App Store Connect
```

Use the same signing identity / Play Console listing as before
(`com.littlebowl.app`).

## Auth

Native clients use:

```http
Authorization: Bearer <token>
X-Guest-Id: <guest_id>
```

Endpoints: `POST /api/auth/signup`, `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/status`.

Website cookie sessions and HTML auth pages are unchanged.
