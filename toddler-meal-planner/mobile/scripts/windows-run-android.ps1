# LittleBowl Windows Android build helper
# Fixes the two most common local build failures:
#   1) Java 24/25 (use JDK 17)
#   2) CMake path-too-long on Windows
#
# Run from the mobile/ folder:
#   powershell -ExecutionPolicy Bypass -File .\scripts\windows-run-android.ps1

$ErrorActionPreference = "Stop"

$MobileRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $MobileRoot "package.json"))) {
  Write-Error "Could not find mobile/package.json next to scripts/. Expected: $MobileRoot"
}
Set-Location $MobileRoot
Write-Host "==> Mobile project: $MobileRoot"

# Warn if path is too deep (reanimated CMake hits ~250 char limit)
if ($MobileRoot.Length -gt 50) {
  Write-Host ""
  Write-Host "WARNING: Your project path is $($MobileRoot.Length) chars long."
  Write-Host "  CMake may fail with CMAKE_OBJECT_PATH_MAX errors."
  Write-Host "  For best results, clone the repo to a short path like C:\lb"
  Write-Host "  and run from C:\lb\toddler-meal-planner\mobile"
  Write-Host ""
}

# --- Enable Windows long path support (requires admin, safe to re-run) ---
try {
  $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem"
  $current = (Get-ItemProperty -Path $regPath -Name "LongPathsEnabled" -ErrorAction SilentlyContinue).LongPathsEnabled
  if ($current -ne 1) {
    Write-Host "==> Enabling Windows long path support (needs admin)..."
    New-ItemProperty -Path $regPath -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force -ErrorAction Stop | Out-Null
    Write-Host "==> Long paths enabled. A reboot may be needed for full effect."
  } else {
    Write-Host "==> Windows long paths already enabled."
  }
} catch {
  Write-Host "==> Could not enable long paths (needs admin). Run this once as Administrator:"
  Write-Host '    New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force'
}

# --- JDK 17 (required; Java 25 breaks CMake / Gradle native tasks) ---
$jdkCandidates = @()
$adoptium = "C:\Program Files\Eclipse Adoptium"
if (Test-Path $adoptium) {
  $jdkCandidates += Get-ChildItem $adoptium -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "jdk-17*" }
}
$javaHome = "C:\Program Files\Java"
if (Test-Path $javaHome) {
  $jdkCandidates += Get-ChildItem $javaHome -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "17|jdk-17|jdk17" }
}
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $studioJbr) {
  $jdkCandidates += Get-Item $studioJbr
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
  Write-Host "JDK 17 not found. Install Temurin 17 from:"
  Write-Host "  https://adoptium.net/temurin/releases/?version=17"
  Write-Host "Then re-run this script."
  exit 1
}

$env:JAVA_HOME = $jdk.FullName
$env:Path = "$($env:JAVA_HOME)\bin;" + $env:Path
Write-Host "==> JAVA_HOME = $($env:JAVA_HOME)"
& java -version

# Unset broken JVM opts some machines inherit
Remove-Item Env:_JAVA_OPTIONS -ErrorAction SilentlyContinue

# Prefer a newer CMake when Android SDK has several side-by-side installs
if (-not $env:CMAKE_VERSION) {
  $env:CMAKE_VERSION = "3.31.1"
}
Write-Host "==> CMAKE_VERSION = $($env:CMAKE_VERSION)"

# --- SDK local.properties ---
$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (-not (Test-Path $sdk)) {
  Write-Error "Android SDK not found at $sdk. Open Android Studio SDK Manager and install the SDK."
}

if (-not (Test-Path "android")) {
  Write-Host "==> android/ missing - running expo prebuild"
  npx expo prebuild --platform android
}

$localProps = "android\local.properties"
$sdkEscaped = $sdk.Replace('\', '\\')
Set-Content -Path $localProps -Value "sdk.dir=$sdkEscaped" -Encoding ASCII
Write-Host "==> Wrote $localProps"

# Pin Gradle JVM to JDK 17 inside generated android/ project
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

# Clean native CMake caches that often keep stale long paths
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

if (Test-Path "android\gradlew.bat") {
  Push-Location android
  try {
    .\gradlew.bat --stop | Out-Null
  } catch { }
  Pop-Location
}

Write-Host ""
Write-Host "==> Building and installing..."
Write-Host "    Keep this window open while the build runs."
Write-Host ""
npx expo run:android
