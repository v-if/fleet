# Fleet Telemetry webhook 점검 스크립트
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/telemetry-webhook-check.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/telemetry-webhook-check.ps1 -BaseUrl https://bori-fleet.shop -Vin YOURVIN17CHARS

param(
    [string]$BaseUrl = "",
    [string]$Vin = "",
    [switch]$SkipPost
)

$ErrorActionPreference = "Stop"

function Read-DotEnvValue([string]$name) {
    if (-not (Test-Path ".env")) { return $null }
    $line = Select-String -Path ".env" -Pattern "^$name=" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line.Line -replace "^$name=", "").Trim().Trim('"')
}

Push-Location $PSScriptRoot\..

try {
    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        $BaseUrl = Read-DotEnvValue "NEXT_PUBLIC_APP_URL"
    }
    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        $BaseUrl = "http://localhost:3000"
    }
    $BaseUrl = $BaseUrl.TrimEnd("/")

    $webhookSecret = Read-DotEnvValue "TESLA_TELEMETRY_WEBHOOK_SECRET"
    $cronSecret = Read-DotEnvValue "TESLA_SYNC_CRON_SECRET"

    Write-Host "==> Fleet Telemetry webhook check"
    Write-Host "    Base URL: $BaseUrl"
    Write-Host ""

    if (-not $SkipPost) {
        if ([string]::IsNullOrWhiteSpace($Vin)) {
            $Vin = "5YJTESTVIN0000001"
            Write-Host "!! VIN 미지정 — 테스트용 더미 VIN 사용: $Vin"
            Write-Host "   실제 처리 확인은 -Vin 실제17자리VIN 으로 재실행하세요."
            Write-Host ""
        }

        $headers = @{ "Content-Type" = "application/json" }
        if ($webhookSecret) {
            $headers["Authorization"] = "Bearer $webhookSecret"
        }

        $body = @{
            vin = $Vin
            createdAt = (Get-Date).ToUniversalTime().ToString("o")
            data = @{
                Soc = @{ doubleValue = 72 }
                Location = @{
                    locationValue = @{
                        latitude = 37.5665
                        longitude = 126.9780
                    }
                }
                ChargeState = @{ stringValue = "Disconnected" }
            }
        } | ConvertTo-Json -Depth 6

        $webhookUrl = "$BaseUrl/api/tesla/telemetry"
        Write-Host "==> POST $webhookUrl"

        try {
            $response = Invoke-RestMethod -Uri $webhookUrl -Method POST -Headers $headers -Body $body
            Write-Host "    OK: $($response | ConvertTo-Json -Compress)"
        } catch {
            $status = $_.Exception.Response.StatusCode.value__
            Write-Host "    FAILED: HTTP $status"
            if ($status -eq 401) {
                Write-Host "    힌트: TESLA_TELEMETRY_WEBHOOK_SECRET 과 Authorization 헤더를 확인하세요."
            }
            if ($status -eq 503) {
                Write-Host "    힌트: TESLA_TELEMETRY_ENABLED=false 일 수 있습니다."
            }
            throw
        }
        Write-Host ""
    }

    $statusUrl = "$BaseUrl/api/internal/telemetry/status"
    Write-Host "==> GET $statusUrl"

    $statusHeaders = @{}
    if ($cronSecret) {
        $statusHeaders["Authorization"] = "Bearer $cronSecret"
    }

    try {
        $status = Invoke-RestMethod -Uri $statusUrl -Method GET -Headers $statusHeaders

        Write-Host "    telemetryEnabled: $($status.config.telemetryEnabled)"
        Write-Host "    telemetryPrimaryMode: $($status.config.telemetryPrimaryMode)"
        Write-Host "    webhookUrl: $($status.config.webhookUrl)"
        Write-Host "    lastReceivedAt: $($status.metadata.lastReceivedAt)"
        Write-Host "    lastProcessedAt: $($status.metadata.lastProcessedAt)"
        Write-Host "    pendingIngress: $($status.metadata.pendingIngressCount)"
        Write-Host "    registeredVehicles: $($status.vehicles.registeredCount)"
        Write-Host "    telemetrySnapshots: $($status.vehicles.telemetrySnapshotCount)"
        Write-Host ""

        if ($status.hints.Count -gt 0) {
            Write-Host "==> Hints"
            foreach ($hint in $status.hints) {
                Write-Host "    - $hint"
            }
            Write-Host ""
        }

        if ($status.ingress.recent.Count -gt 0) {
            Write-Host "==> Recent ingress"
            $status.ingress.recent | Select-Object -First 5 | ForEach-Object {
                Write-Host "    $($_.receivedAt) vin=$($_.vin) status=$($_.status) error=$($_.errorMessage)"
            }
            Write-Host ""
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "    SKIPPED: HTTP $statusCode (status API 미배포 또는 인증 필요)"
        Write-Host "    힌트: 최신 코드 배포 후 재실행하거나 Supabase에서 scripts/telemetry-status.sql 실행"
        Write-Host ""
    }

    Write-Host "==> Done"
    Write-Host "    Supabase 상세 조회: scripts/telemetry-status.sql"
}
finally {
    Pop-Location
}
