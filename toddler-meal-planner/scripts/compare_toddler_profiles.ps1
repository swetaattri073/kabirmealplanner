# Compare meal plan + nutrition targets across toddler refs (authenticated).
# Usage: .\compare_toddler_profiles.ps1 -Email you@example.com -Password '...' -Refs @('ref1','ref2')
param(
    [string]$Email = "sweta@gmail.com",
    [Parameter(Mandatory=$true)][string]$Password,
    [string[]]$Refs = @()
)

$Base = "https://littlebowl.in"

$login = Invoke-RestMethod "$Base/api/auth/login" -Method POST -ContentType "application/json" `
    -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
$token = $login.token
if (-not $token) { throw "Login failed: $($login.error)" }
$h = @{ Authorization = "Bearer $token"; Accept = "application/json" }

$toddlers = Invoke-RestMethod "$Base/api/toddlers" -Headers $h
if ($Refs.Count -eq 0) {
    $Refs = @($toddlers | ForEach-Object { $_.ref })
}

Write-Host "`n=== Account: $Email ($($toddlers.Count) children) ===" -ForegroundColor Cyan

foreach ($t in $toddlers) {
    Write-Host ("  {0,-8} age={1,2}mo diet={2,-16} activity={3}" -f $t.name, $t.age_months, $t.dietary_preference, $t.activity_level)
}

foreach ($ref in $Refs) {
    $t = $toddlers | Where-Object { $_.ref -eq $ref } | Select-Object -First 1
    if (-not $t) { Write-Host "Skip unknown ref $ref" -ForegroundColor Yellow; continue }

    Write-Host "`n========== $($t.name) ($($t.age_months) mo) ==========" -ForegroundColor Green
    Write-Host "  diet=$($t.dietary_preference) activity=$($t.activity_level) allergies=$($t.allergies -join ',')"

    $dash = Invoke-RestMethod "$Base/api/dashboard/$ref" -Headers $h
    $meals = @($dash.today_plan.meals.PSObject.Properties | ForEach-Object { $_.Name })
    Write-Host "  today_meals: $($meals -join ', ')"

    $plan = Invoke-RestMethod "$Base/api/meal-plan/weekly/$ref" -Headers $h
    $mon = $plan.days | Where-Object { $_.day -eq 'Monday' } | Select-Object -First 1
    $monFoods = @()
    if ($mon) {
        foreach ($m in @('breakfast','lunch','dinner','snack','evening_snack')) {
            if ($mon.meals.$m.food.name) { $monFoods += "$m=$($mon.meals.$m.food.name)" }
        }
    }
    Write-Host "  monday_plan: $($monFoods -join ' | ')"
    Write-Host "  weaning_block: $(if ($plan.weaning) { 'yes' } else { 'no' })"

    $nut = Invoke-RestMethod "$Base/api/nutrition/weekly/$ref" -Headers $h
    $targets = $nut.weekly_targets
    if ($targets) {
        Write-Host ("  calorie_target: {0} kcal (protein {1}g)" -f $targets.calories, $targets.protein_g)
    }

    $w = Invoke-RestMethod "$Base/api/weaning/$ref" -Headers $h
    Write-Host "  is_weaning: $($w.is_weaning) stage: $($w.stage.name)"
}
