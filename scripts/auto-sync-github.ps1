# Auto-sync local code changes to GitHub repository danidetenerife/nucelar
$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

$status = git status --porcelain
if (-not $status) {
    Write-Host "[Git Auto-Sync] No hay cambios pendientes para subir." -ForegroundColor Green
    exit 0
}

Write-Host "[Git Auto-Sync] Cambios detectados. Preparando commit..." -ForegroundColor Cyan
git add .

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMsg = "auto: sync updates $timestamp"

git commit -m $commitMsg
Write-Host "[Git Auto-Sync] Subiendo cambios a GitHub (main)..." -ForegroundColor Cyan
git push origin main

Write-Host "[Git Auto-Sync] ¡Cambios subidos a GitHub con éxito!" -ForegroundColor Green
