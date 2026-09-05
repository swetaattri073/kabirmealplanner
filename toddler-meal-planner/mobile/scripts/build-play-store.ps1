# Build a signed Android App Bundle (.aab) for Google Play Store upload.
#
# Prerequisites:
#   - JDK 17, Android SDK + NDK (same as windows-run-android.ps1)
#   - Short project path recommended: C:\lb\toddler-meal-planner\mobile
#   - Upload keystore + android/keystore.properties (see create-android-keystore.ps1)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\build-play-store.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\build-play-store.ps1 -Clean
#   powershell -ExecutionPolicy Bypass -File .\scripts\build-play-store.ps1 -EasCloud
#
# Output:
#   android\app\build\outputs\bundle\release\app-release.aab

param(
  [switch]$Clean,
  [switch]$EasCloud,
  [switch]$EasLocal
)

$ErrorActionPreference = "Stop"

$MobileRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $MobileRoot "package.json"))) {
  Write-Error "Could not find mobile/package.json. Expected: $MobileRoot"
}
Set-Location $MobileRoot
Write-Host "==> LittleBowl Play Store build"
Write-Host "    Project: $MobileRoot"

if ($MobileRoot.Length -gt 50) {
  Write-Host ""
  Write-Host "!! WARNING: Path is $($MobileRoot.Length) chars. Use C:\lb\toddler-meal-planner\mobile for reliable builds."
  Write-Host ""
}

# --- EAS cloud / local (optional) ---
if ($EasCloud -or $EasLocal) {
  Write-Host "==> Using EAS Build ($(
    if ($EasCloud) { 'cloud' } else { 'local' }
  ))..."
  if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Error "npx not found."
  }
  $easArgs = @("eas", "build", "-p", "android", "--profile", "production", "--non-interactive")
  if ($EasLocal) { $easArgs += "--local" }
  Write-Host "    Run: npx $($easArgs -join ' ')"
  Write-Host ""
  Write-Host "    First time: npx eas login && npx eas init  (links projectId in app.json)"
  Write-Host ""
  & npx @easArgs
  exit $LASTEXITCODE
}

# --- JDK 17 ---
$jdkCandidates = @()
$adoptium = "C:\Program Files\Eclipse Adoptium"
if (Test-Path $adoptium) {
  $jdkCandidates += Get-ChildItem $adoptium -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "jdk-17*" }
}
$javaDir = "C:\Program Files\Java"
if (Test-Path $javaDir) {
  $jdkCandidates += Get-ChildItem $javaDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "jdk.?17" }
}
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
  Write-Host "!! JDK 17 not found. Install Temurin 17: https://adoptium.net/temurin/releases/?version=17"
  exit 1
}

$env:JAVA_HOME = $jdk.FullName
$env:Path = "$($env:JAVA_HOME)\bin;" + $env:Path
Remove-Item Env:_JAVA_OPTIONS -ErrorAction SilentlyContinue
Write-Host "==> JAVA_HOME = $($env:JAVA_HOME)"

if (-not $env:CMAKE_VERSION) { $env:CMAKE_VERSION = "3.31.1" }

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (-not (Test-Path $sdk)) {
  Write-Error "Android SDK not found at $sdk"
}
Write-Host "==> Android SDK: $sdk"

# --- Prebuild ---
if ($Clean -or -not (Test-Path "android")) {
  Write-Host "==> Running expo prebuild --platform android$(if ($Clean) { ' --clean' })..."
  if ($Clean -and (Test-Path "android")) {
    npx expo prebuild --platform android --clean
  } else {
    npx expo prebuild --platform android
  }
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# --- local.properties + gradle java home ---
$localProps = "android\local.properties"
$sdkEscaped = $sdk.Replace('\', '\\')
Set-Content -Path $localProps -Value "sdk.dir=$sdkEscaped" -Encoding ASCII

$gradleProps = "android\gradle.properties"
$jdkEscaped = $env:JAVA_HOME.Replace('\', '\\')
$javaHomeLine = "org.gradle.java.home=$jdkEscaped"
if (Test-Path $gradleProps) {
  $lines = Get-Content $gradleProps | Where-Object { $_ -notmatch '^\s*org\.gradle\.java\.home=' }
  $lines + $javaHomeLine | Set-Content $gradleProps -Encoding ASCII
}

# --- Release signing (credentials live outside android/ so prebuild --clean is safe) ---
$credentialsDir = Join-Path $MobileRoot "credentials"
$keystorePropsSrc = Join-Path $credentialsDir "keystore.properties"
$keystorePropsDest = Join-Path $MobileRoot "android\keystore.properties"

if (-not (Test-Path $keystorePropsSrc)) {
  Write-Host ""
  Write-Host "!! Missing credentials\keystore.properties"
  Write-Host "!! 1) Reuse your Capacitor upload keystore, OR"
  Write-Host "!! 2) npm run keystore:create"
  Write-Host "!! 3) Copy scripts\keystore.properties.example -> credentials\keystore.properties"
  exit 1
}

New-Item -ItemType Directory -Force -Path $credentialsDir | Out-Null
Copy-Item -Force $keystorePropsSrc $keystorePropsDest
Write-Host "==> Linked android\keystore.properties from credentials\"

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "apply-release-signing.ps1")
if ($LASTEXITCODE -ne 0) { exit 1 }

# --- Clean release caches (keep debug if not -Clean) ---
$releaseClean = @(
  "android\app\build\outputs\bundle\release",
  "android\app\build\intermediates\bundle_release",
  "android\app\build\generated\assets\createBundleReleaseJsAndAssets",
  "android\app\build\generated\res\createBundleReleaseJsAndAssets"
)
foreach ($p in $releaseClean) {
  if (Test-Path $p) { Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue }
}

if ($Clean) {
  $deepClean = @("android\app\.cxx", "android\app\build", "android\build")
  foreach ($p in $deepClean) {
    if (Test-Path $p) { Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue }
  }
}

Push-Location android
try {
  Write-Host ""
  Write-Host "==> gradlew bundleRelease (this may take several minutes)..."
  .\gradlew.bat --stop 2>&1 | Out-Null
  .\gradlew.bat bundleRelease --no-daemon
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

if ($code -ne 0) {
  Write-Host "!! Build failed."
  exit $code
}

$aab = Join-Path $MobileRoot "android\app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $aab)) {
  Write-Error "Expected AAB not found: $aab"
}

$releaseDir = Join-Path $MobileRoot "release"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$version = (Select-String -Path (Join-Path $MobileRoot "app.json") -Pattern '"version"\s*:\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value })
$versionCode = (Select-String -Path (Join-Path $MobileRoot "android\app\build.gradle") -Pattern 'versionCode\s+(\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value })
$destName = "littlebowl-$version-$versionCode.aab"
$destAab = Join-Path $releaseDir $destName
Copy-Item -Force $aab $destAab

$sizeMb = [math]::Round((Get-Item $destAab).Length / 1MB, 2)
Write-Host ""
Write-Host "========================================"
Write-Host " Play Store bundle ready"
Write-Host "========================================"
Write-Host " File: $destAab"
Write-Host " Also: $aab"
Write-Host " Size: ${sizeMb} MB"
Write-Host ""
Write-Host " Upload in Play Console:"
Write-Host "   Release > Production (or Internal testing) > Create release > Upload"
Write-Host ""
Write-Host " Package: com.littlebowl.app"
Write-Host " versionCode must increase each upload (currently set in app.json)."
Write-Host ""
