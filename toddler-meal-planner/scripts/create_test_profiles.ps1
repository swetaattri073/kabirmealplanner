# Create Mira (6mo) and Arjun (10mo) on authenticated account, then list toddlers.
param(
    [string]$Email = "sweta@gmail.com",
    [Parameter(Mandatory = $true)][string]$Password
)

$Base = "https://littlebowl.in"
$login = Invoke-RestMethod "$Base/api/auth/login" -Method POST -ContentType "application/json" `
    -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
if (-not $login.token) { throw "Login failed: $($login.error)" }
$h = @{ Authorization = "Bearer $($login.token)"; "Content-Type" = "application/json"; Accept = "application/json" }

function New-Child($name, $ageMonths, $diet, $activity) {
    $bd = (Get-Date).AddMonths(-$ageMonths).ToString("yyyy-MM-dd")
    $body = @{
        name                 = $name
        birth_date           = $bd
        age_months           = $ageMonths
        dietary_preference   = $diet
        activity_level       = $activity
        allergies            = @()
    } | ConvertTo-Json
    try {
        $r = Invoke-RestMethod "$Base/api/toddlers" -Method POST -Headers $h -Body $body
        Write-Host "Created $($r.name) ($($r.age_months) mo) ref=$($r.ref)" -ForegroundColor Green
        return $r
    } catch {
        Write-Host "Skip/create failed for ${name}: $($_.Exception.Message)" -ForegroundColor Yellow
        return $null
    }
}

$existing = Invoke-RestMethod "$Base/api/toddlers" -Headers $h
Write-Host "Before: $($existing.Count) children" -ForegroundColor Cyan
$existing | ForEach-Object { Write-Host "  $($_.name) $($_.age_months)mo $($_.dietary_preference)" }

if (-not ($existing | Where-Object { $_.name -eq "Mira" })) { New-Child "Mira" 6 "vegetarian" "moderate" }
if (-not ($existing | Where-Object { $_.name -eq "Arjun" })) { New-Child "Arjun" 10 "non_vegetarian" "high" }

$after = Invoke-RestMethod "$Base/api/toddlers" -Headers $h
Write-Host "`nAfter: $($after.Count) children" -ForegroundColor Cyan
$after | ForEach-Object { Write-Host "  $($_.name) $($_.age_months)mo $($_.dietary_preference) ref=$($_.ref)" }
