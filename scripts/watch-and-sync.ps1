# Continuous watcher that automatically commits and pushes code modifications to GitHub
param(
    [int]$DebounceSeconds = 8
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Nuclear GitHub Auto-Sync Watcher Iniciado" -ForegroundColor Green
Write-Host " Repositorio: https://github.com/danidetenerife/nucelar" -ForegroundColor Cyan
Write-Host " Monitoreando cambios en packages/ y plugins/..." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

while ($true) {
    Start-Sleep -Seconds $DebounceSeconds
    $status = git status --porcelain
    if ($status) {
        $changedCount = ($status | Measure-Object).Count
        Write-Host "[Auto-Sync] Se detectaron $changedCount archivos modificados. Sincronizando con GitHub..." -ForegroundColor Cyan
        git add .
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "auto: update codebase ($timestamp)"
        git push origin main
        Write-Host "[Auto-Sync] ¡Sincronización completada en GitHub! ($timestamp)" -ForegroundColor Green
    }
}
