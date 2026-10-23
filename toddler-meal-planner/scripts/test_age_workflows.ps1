# Workflow smoke test for 8, 10, 18 month profiles against production API
$Base = "https://littlebowl.in"
$ages = @(8, 10, 18)

function Get-GuestSession {
    $status = Invoke-RestMethod "$Base/api/auth/status"
    return @{ GuestId = $status.guest_id }
}

function New-Toddler($guestId, $ageMonths, $name) {
    $bd = (Get-Date).AddMonths(-$ageMonths).ToString("yyyy-MM-dd")
    $headers = @{ "X-Guest-Id" = $guestId; "Content-Type" = "application/json" }
    $body = @{
        name = $name
        age_months = $ageMonths
        birth_date = $bd
        dietary_preference = "vegetarian"
        allergies = @()
    } | ConvertTo-Json
    try {
        $r = Invoke-WebRequest -Uri "$Base/api/toddlers" -Method POST -Headers $headers -Body $body -UseBasicParsing
        return @{ Ok = $true; Data = ($r.Content | ConvertFrom-Json); Status = $r.StatusCode }
    } catch {
        $resp = $_.Exception.Response
        $code = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $txt = $reader.ReadToEnd()
        return @{ Ok = $false; Status = $code; Error = $txt }
    }
}

function Test-Endpoint($guestId, $ref, $path, $method = "GET", $body = $null) {
    $headers = @{ "X-Guest-Id" = $guestId; "Accept" = "application/json" }
    if ($body) { $headers["Content-Type"] = "application/json" }
    $uri = if ($path -match "^https") { $path } else { "$Base$path" }
    try {
        $params = @{ Uri = $uri; Method = $method; Headers = $headers; UseBasicParsing = $true }
        if ($body) { $params.Body = ($body | ConvertTo-Json) }
        $r = Invoke-WebRequest @params
        return @{ Ok = $true; Status = $r.StatusCode; Data = ($r.Content | ConvertFrom-Json) }
    } catch {
        $resp = $_.Exception.Response
        $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
        $txt = ""
        if ($resp) {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $txt = $reader.ReadToEnd()
            try { $txt = ($txt | ConvertFrom-Json).error } catch {}
        }
        return @{ Ok = $false; Status = $code; Error = $txt }
    }
}

foreach ($age in $ages) {
    Write-Host "`n========== AGE $age MONTHS ==========" -ForegroundColor Cyan
    $sess = Get-GuestSession
    $g = $sess.GuestId
    $create = New-Toddler $g $age "TestBaby$age"
    if (-not $create.Ok) {
        Write-Host "FAIL create toddler: $($create.Status) $($create.Error)" -ForegroundColor Red
        continue
    }
    $ref = $create.Data.ref
    if (-not $ref) { $ref = $create.Data.id }
    Write-Host "Created toddler ref=$ref age=$($create.Data.age_months)" -ForegroundColor Green

    $tests = @(
        @{ Name = "dashboard"; Path = "/api/dashboard/$ref" }
        @{ Name = "weaning"; Path = "/api/weaning/$ref" }
        @{ Name = "recipes_age_filter"; Path = "/api/recipes?age_months=$age" }
        @{ Name = "weekly_plan"; Path = "/api/meal-plan/weekly/$ref" }
        @{ Name = "nutrition_weekly"; Path = "/api/nutrition/weekly/$ref" }
        @{ Name = "growth_get"; Path = "/api/growth/$ref" }
        @{ Name = "growth_post"; Path = "/api/growth/$ref"; Method = "POST"; Body = @{ weight_kg = 8.2; height_cm = 68 } }
        @{ Name = "mini_plans"; Path = "/api/meal-plan/mini?age_months=$age" }
        @{ Name = "try_food"; Path = "/api/weaning/$ref/try-food"; Method = "POST"; Body = @{ food_name = "Ragi Porridge"; reaction = "liked" } }
        @{ Name = "chat_health"; Path = "/api/chat/health" }
    )

    foreach ($t in $tests) {
        $r = Test-Endpoint $g $ref $t.Path $t.Method $t.Body
        $status = if ($r.Ok) { "OK $($r.Status)" } else { "FAIL $($r.Status) $($r.Error)" }
        $color = if ($r.Ok) { "Green" } else { "Red" }
        Write-Host ("  {0,-22} {1}" -f $t.Name, $status) -ForegroundColor $color
    }

    # Weaning-specific checks
    if ($age -lt 12) {
        $w = Test-Endpoint $g $ref "/api/weaning/$ref"
        if ($w.Ok) {
            $checklist = $w.Data.checklist
            $hasChecklist = $null -ne $checklist -and $checklist.Count -gt 0
            Write-Host ("  {0,-22} {1}" -f "checklist_present", $(if ($hasChecklist) { "OK" } else { "FAIL missing" })) -ForegroundColor $(if ($hasChecklist) { "Green" } else { "Yellow" })
        }
    }

    $recipes = Test-Endpoint $g $ref "/api/recipes?age_months=$age"
    if ($recipes.Ok) {
        $count = $recipes.Data.recipes.Count
        $bad = @($recipes.Data.recipes | Where-Object { $_.suitable_from_months -and $_.suitable_from_months -gt $age })
        Write-Host ("  {0,-22} count=$count inappropriate=$($bad.Count)") -ForegroundColor $(if ($bad.Count -eq 0) { "Green" } else { "Yellow" })
    }
}
