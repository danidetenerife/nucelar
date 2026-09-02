param(
    [string]$Version = "1.47.1",
    [string]$Notes = "Nuclear Music Player con auto-actualización universal e integración GitHub Releases"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

$Tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
$ExecutablesDir = "$Root\ejecutables"
$ApkPath = "$ExecutablesDir\nuclear-music-player.apk"
$ExePath = "$ExecutablesDir\Nuclear_1.47.1_x64-setup.exe"

if (-not (Test-Path $ApkPath)) {
    Write-Error "No se encontró el APK en: $ApkPath"
}

if (-not (Test-Path $ExePath)) {
    Write-Error "No se encontró el instalador de Windows en: $ExePath"
}

# Create latest.json for Tauri updater
$latestJsonContent = @{
    version = $Version.Replace("v", "")
    notes = $Notes
    pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
        "windows-x86_64" = @{
            signature = ""
            url = "https://github.com/danidetenerife/nucelar/releases/download/$Tag/Nuclear_1.47.1_x64-setup.exe"
        }
    }
} | ConvertTo-Json -Depth 5

$LatestJsonPath = "$ExecutablesDir\latest.json"
Set-Content -Path $LatestJsonPath -Value $latestJsonContent -Encoding UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Publicando Release $Tag en GitHub..." -ForegroundColor Green
Write-Host " Archivos a subir:" -ForegroundColor Cyan
Write-Host " - APK: $ApkPath"
Write-Host " - Windows EXE: $ExePath"
Write-Host " - Tauri JSON: $LatestJsonPath"
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if release already exists
$releaseExists = gh release view $Tag 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "El release $Tag ya existe. Actualizando assets..." -ForegroundColor Yellow
    gh release upload $Tag $ApkPath $ExePath $LatestJsonPath --clobber
} else {
    gh release create $Tag $ApkPath $ExePath $LatestJsonPath --title "Nuclear Player $Tag" --notes $Notes
}

Write-Host "¡Release $Tag publicado exitosamente en GitHub!" -ForegroundColor Green
Write-Host "URL: https://github.com/danidetenerife/nucelar/releases/tag/$Tag" -ForegroundColor Cyan
