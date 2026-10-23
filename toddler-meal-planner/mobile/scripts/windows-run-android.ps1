# LittleBowl Windows Android build helper
#
# Fixes two Windows-only environment issues:
#   1) Java 24/25 breaks Gradle CMake tasks (need JDK 17)
#   2) Long project paths exceed CMake 250-char object-path limit
#
# IMPORTANT: This script must be run from a SHORT project path.
# If your project is under a deep directory like
#   C:\Users\sweta\Documents\GitHub\kabirmealplanner\toddler-meal-planner\mobile
# clone the repo to a short path first:
#   cd C:\
#   git clone https://github.com/swetaattri073/kabirmealplanner.git lb
#   cd C:\lb\toddler-meal-planner\mobile
#   npm install
#   powershell -ExecutionPolicy Bypass -File .\scripts\windows-run-android.ps1
#
# Prerequisites:
#   - JDK 17 (https://adoptium.net/temurin/releases/?version=17)
#   - Android Studio with SDK, NDK, CMake installed
#   - An emulator running OR a phone with USB debugging enabled

$ErrorActionPreference = "Stop"

$MobileRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $MobileRoot "package.json"))) {
  Write-Error "Could not find mobile/package.json next to scripts/. Expected: $MobileRoot"
}
Set-Location $MobileRoot
Write-Host "==> Mobile project: $MobileRoot"

# Check path length and warn
if ($MobileRoot.Length -gt 40) {
  Write-Host ""
  Write-Host "!! WARNING: Project path is $($MobileRoot.Length) characters."
  Write-Host "!! CMake needs paths under ~50 chars to stay within the 250-char object limit."
  Write-Host "!! Clone the repo to a short path:"
  Write-Host "!!   cd C:\"
  Write-Host "!!   git clone https://github.com/swetaattri073/kabirmealplanner.git lb"
  Write-Host "!!   cd C:\lb\toddler-meal-planner\mobile"
  Write-Host "!!   npm install"
  Write-Host "!!   powershell -ExecutionPolicy Bypass -File .\scripts\windows-run-android.ps1"
  Write-Host ""
  $continue = Read-Host "Continue anyway? (y/n)"
  if ($continue -ne "y") { exit 0 }
}

# --- Enable Windows long path support (best-effort, needs admin) ---
try {
  $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem"
  $current = (Get-ItemProperty -Path $regPath -Name "LongPathsEnabled" -ErrorAction SilentlyContinue).LongPathsEnabled
  if ($current -ne 1) {
    Write-Host "==> Enabling Windows long path support (needs admin)..."
    New-ItemProperty -Path $regPath -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force -ErrorAction Stop | Out-Null
    Write-Host "==> Done. Reboot for full effect."
  } else {
    Write-Host "==> Windows long paths: already enabled"
  }
} catch {
  Write-Host "==> Skipped long path registry (run as admin once):"
  Write-Host '   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force'
}

# --- JDK 17 ---
$jdkCandidates = @()

# Check Eclipse Adoptium (Temurin)
$adoptium = "C:\Program Files\Eclipse Adoptium"
if (Test-Path $adoptium) {
  $jdkCandidates += Get-ChildItem $adoptium -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "jdk-17*" }
}

# Check Oracle/other JDK installs
$javaDir = "C:\Program Files\Java"
if (Test-Path $javaDir) {
  $jdkCandidates += Get-ChildItem $javaDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "jdk.?17" }
}

# Check Android Studio bundled JBR (only if it's JDK 17)
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $studioJbr) {
  $release = Join-Path $studioJbr "release"
  if ((Test-Path $release) -and ((Get-Content $release -Raw) -match 'JAVA_VERSION="17')) {
    $jdkCandidates += Get-Item $studioJbr
  }
}

$jdk = $jdkCandidates | Where-Object {
  $release = Join-Path $_.FullName "release"
  if (Test-Path $release) {
    (Get-Content $release -Raw) -match 'JAVA_VERSION="17'
  } else {
    $_.Name -match "17"
  }
} | Select-Object -First 1

if (-not $jdk) {
  Write-Host ""
  Write-Host "!! JDK 17 not found."
  Write-Host "!! Install Eclipse Temurin 17 from:"
  Write-Host "!!   https://adoptium.net/temurin/releases/?version=17"
  Write-Host "!! During install, check 'Set JAVA_HOME' and 'Add to PATH'."
  Write-Host "!! Then re-run this script."
  exit 1
}

$env:JAVA_HOME = $jdk.FullName
$env:Path = "$($env:JAVA_HOME)\bin;" + $env:Path
Write-Host "==> JAVA_HOME = $($env:JAVA_HOME)"
$ErrorActionPreference = "Continue"
& java -version 2>&1 | ForEach-Object { Write-Host "    $_" }
$ErrorActionPreference = "Stop"

# Unset _JAVA_OPTIONS (some machines inherit broken flags)
Remove-Item Env:_JAVA_OPTIONS -ErrorAction SilentlyContinue

# --- CMake version hint ---
if (-not $env:CMAKE_VERSION) {
  $env:CMAKE_VERSION = "3.31.1"
}
Write-Host "==> CMAKE_VERSION = $($env:CMAKE_VERSION)"

# --- Android SDK ---
$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (-not (Test-Path $sdk)) {
  Write-Host "!! Android SDK not found at $sdk"
  Write-Host "!! Open Android Studio > SDK Manager and install the SDK."
  exit 1
}
Write-Host "==> Android SDK: $sdk"

# --- Prebuild android/ if missing ---
if (-not (Test-Path "android")) {
  Write-Host "==> android/ missing - running expo prebuild..."
  npx expo prebuild --platform android
  if ($LASTEXITCODE -ne 0) {
    Write-Host "!! Prebuild failed. Check errors above."
    exit 1
  }
}

# --- Write local.properties ---
$localProps = "android\local.properties"
$sdkEscaped = $sdk.Replace('\', '\\')
Set-Content -Path $localProps -Value "sdk.dir=$sdkEscaped" -Encoding ASCII
Write-Host "==> Wrote $localProps"

# --- Pin org.gradle.java.home to JDK 17 ---
$gradleProps = "android\gradle.properties"
$jdkEscaped = $env:JAVA_HOME.Replace('\', '\\')
$javaHomeLine = "org.gradle.java.home=$jdkEscaped"
if (Test-Path $gradleProps) {
  $lines = Get-Content $gradleProps | Where-Object { $_ -notmatch '^\s*org\.gradle\.java\.home=' }
  $lines + $javaHomeLine | Set-Content $gradleProps -Encoding ASCII
} else {
  Set-Content $gradleProps -Value $javaHomeLine -Encoding ASCII
}
Write-Host "==> Set org.gradle.java.home in gradle.properties"

# --- Clean stale CMake / build caches ---
$cleanPaths = @(
  "android\.cxx",
  "android\app\.cxx",
  "android\build",
  "android\app\build",
  "node_modules\react-native-reanimated\android\.cxx",
  "node_modules\react-native-reanimated\android\build",
  "node_modules\react-native-worklets\android\.cxx",
  "node_modules\react-native-worklets\android\build",
  "node_modules\react-native-screens\android\.cxx",
  "node_modules\react-native-screens\android\build"
)
foreach ($p in $cleanPaths) {
  if (Test-Path $p) {
    Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
    Write-Host "==> Cleaned $p"
  }
}

# --- Stop any running Gradle daemons (may hold old JDK) ---
if (Test-Path "android\gradlew.bat") {
  Push-Location android
  try { .\gradlew.bat --stop 2>&1 | Out-Null } catch { }
  Pop-Location
  Write-Host "==> Stopped Gradle daemons"
}

# --- Build ---
Write-Host ""
Write-Host "==> Building and installing LittleBowl..."
Write-Host "    Keep this window open while the build runs."
Write-Host ""
npx expo run:android
