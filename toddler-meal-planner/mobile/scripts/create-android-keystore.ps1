# Create an Android upload keystore for Play Store signing.
# Skip if you already have the keystore from the legacy Capacitor app — reuse that file.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\create-android-keystore.ps1

$ErrorActionPreference = "Stop"

$MobileRoot = Split-Path -Parent $PSScriptRoot
Set-Location $MobileRoot

$credentialsDir = Join-Path $MobileRoot "credentials"
$keystorePath = Join-Path $credentialsDir "littlebowl-upload-key.jks"
if (Test-Path $keystorePath) {
  Write-Host "Keystore already exists: $keystorePath"
  Write-Host "Delete it first if you intentionally want a new one."
  exit 0
}

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

$keytool = $null
foreach ($jdk in $jdkCandidates) {
  $candidate = Join-Path $jdk.FullName "bin\keytool.exe"
  if (Test-Path $candidate) {
    $keytool = $candidate
    break
  }
}
if (-not $keytool) {
  $keytoolCmd = Get-Command keytool -ErrorAction SilentlyContinue
  if ($keytoolCmd) { $keytool = $keytoolCmd.Source }
}

if (-not $keytool) {
  Write-Error "keytool not found. Install JDK 17 (Temurin) and retry."
}

New-Item -ItemType Directory -Force -Path $credentialsDir | Out-Null

Write-Host ""
Write-Host "Creating upload keystore for com.littlebowl.app"
Write-Host "You will be prompted for store/key passwords — save them securely."
Write-Host "Play Console needs this keystore (or the same one from your Capacitor build)."
Write-Host ""

& $keytool -genkeypair -v `
  -keystore $keystorePath `
  -alias littlebowl `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -dname "CN=LittleBowl, OU=Mobile, O=LittleBowl, L=India, ST=India, C=IN"

if ($LASTEXITCODE -ne 0) {
  Write-Error "keytool failed."
}

$propsExample = Join-Path $PSScriptRoot "keystore.properties.example"
$propsDest = Join-Path $credentialsDir "keystore.properties"
if (-not (Test-Path $propsDest)) {
  Copy-Item $propsExample $propsDest
  Write-Host ""
  Write-Host "Created $propsDest — edit storePassword and keyPassword."
}

Write-Host ""
Write-Host "Done: $keystorePath"
