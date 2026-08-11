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

## Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- **Android:** Android Studio + emulator/device + **JDK 17** (not Java 25)
- **iOS:** macOS + Xcode (for device/App Store builds)

```bash
cd toddler-meal-planner/mobile
npm install
npx expo start
```

Optional local API:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000 npx expo start
```

## Expo Go vs development build

**Expo Go** (QR code) is fine for quick UI checks, but on recent Expo SDKs
Android notifications are **not** supported there and may log an error.

For a real device/emulator build (notifications + camera like production):

```bash
# Emulator running in Android Studio, OR phone with USB debugging
npx expo run:android
```

That generates `android/`, compiles, and installs **LittleBowl** (not Expo Go).

## Windows Android build (required local setup)

Building React Native / Reanimated on Windows often fails for two reasons that
are **environment**, not app code:

1. **Java 24/25** — use **JDK 17** (Temurin 17). Android Studio’s bundled JBR
   may be Java 25; that is too new for this Gradle/CMake build.
2. **Path too long** — CMake warns/fails when object paths exceed ~250 chars
   (`CMAKE_OBJECT_PATH_MAX`). Paths under
   `C:\Users\...\Documents\GitHub\kabirmealplanner\toddler-meal-planner\mobile\...`
   are too deep. Use a short mount (recommended) or move the project near `C:\`.

### One-command helper (recommended)

From `toddler-meal-planner\mobile` in PowerShell:

```powershell
# Once: install JDK 17 from https://adoptium.net/temurin/releases/?version=17
# Emulator running OR phone with USB debugging
powershell -ExecutionPolicy Bypass -File .\scripts\windows-run-android.ps1
```

The script:

- sets `JAVA_HOME` to JDK 17
- mounts this folder as drive `L:` (`subst`) so CMake paths stay short
- writes `android\local.properties` (`sdk.dir=...`)
- pins `org.gradle.java.home` in `android\gradle.properties`
- cleans stale `.cxx` / build caches
- runs `npx expo run:android` from `L:\`

### Manual short-path alternative

```powershell
cd C:\Users\sweta\Documents\GitHub\kabirmealplanner\toddler-meal-planner\mobile
subst L: .
cd L:\
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.XX-hotspot"  # your folder
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
Set-Content android\local.properties 'sdk.dir=C:\\Users\\sweta\\AppData\\Local\\Android\\Sdk'
npx expo run:android
```

Also enable Windows long paths (Admin PowerShell, then reboot):

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

In Android Studio → SDK Manager → SDK Tools, install **CMake 3.22+** (prefer
3.31.x) and **NDK 27.1.12297006**. Optional: set env `CMAKE_VERSION=3.31.1`.

Do **not** disable New Architecture or downgrade Reanimated to “fix” these
errors — that postpones breakage (see Reanimated’s Windows guide).

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
