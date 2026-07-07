# Phase 3.6 - Supabase PostgreSQL setup
# Usage: set Supabase Connection String in .env, then run:
#   pnpm db:setup

param(
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$env:Path = "$env:LOCALAPPDATA\pnpm;$env:Path"

function Require-Env($name) {
    if (-not (Get-Item "Env:$name" -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace((Get-Item "Env:$name").Value)) {
        $line = Select-String -Path ".env" -Pattern "^$name=" -ErrorAction SilentlyContinue
        if (-not $line) {
            Write-Error "$name is missing in .env. See .env.example Phase 3.6."
        }
        $value = ($line.Line -replace "^$name=", "").Trim('"')
        if ($value -match "^\[ref\]|file:") {
            Write-Error "$name is not configured. Copy Connection String from Supabase dashboard."
        }
    }
}

Push-Location $PSScriptRoot\..

Write-Host "==> Phase 3.6 DB setup validation"
if (-not (Test-Path ".env")) {
    Write-Error ".env not found. Copy from .env.example and configure it."
}

Require-Env "DATABASE_URL"
Require-Env "DIRECT_URL"

Write-Host "==> Prisma client generate"
pnpm exec prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Apply migrations (PostgreSQL)"
pnpm exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipSeed) {
    Write-Host "==> Seed data"
    pnpm db:seed
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "==> Done. Run pnpm dev and check:"
Write-Host 'GET http://localhost:3000/api/vehicles'

Pop-Location
