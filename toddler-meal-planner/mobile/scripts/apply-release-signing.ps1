# Patch android/app/build.gradle so release builds use android/keystore.properties.
# Safe to re-run after expo prebuild (idempotent).

$ErrorActionPreference = "Stop"

$MobileRoot = Split-Path -Parent $PSScriptRoot
$buildGradle = Join-Path $MobileRoot "android\app\build.gradle"
$keystoreProps = Join-Path $MobileRoot "android\keystore.properties"

if (-not (Test-Path $buildGradle)) {
  Write-Error "Missing $buildGradle - run expo prebuild first."
}

$content = Get-Content $buildGradle -Raw

$signingBlock = @'
// LittleBowl release signing (scripts/apply-release-signing.ps1)
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

'@

if ($content -notmatch "def keystorePropertiesFile") {
  $marker = "android {"
  $idx = $content.IndexOf($marker)
  if ($idx -lt 0) { Write-Error "Could not find android block in build.gradle" }
  $insertAt = $idx + $marker.Length
  $content = $content.Insert($insertAt, $signingBlock)
}

$newSigningConfigs = @'
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
'@

$content = [regex]::Replace(
  $content,
  '(?ms)\s*signingConfigs\s*\{.*?(?=\s*buildTypes\s*\{)',
  "`n$newSigningConfigs`n",
  1
)

$oldRelease = @'
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
'@

$newRelease = @'
        release {
            signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug
'@

$content = $content.Replace($oldRelease, $newRelease)

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($buildGradle, $content, $utf8NoBom)
Write-Host "==> Patched $buildGradle for release signing"

if (-not (Test-Path $keystoreProps)) {
  Write-Host ""
  Write-Host "!! android/keystore.properties not found."
  Write-Host "!! Copy credentials/keystore.properties or run npm run keystore:create"
}
