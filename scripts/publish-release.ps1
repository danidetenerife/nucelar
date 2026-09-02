param(
    [string]$Version = "1.47.1",
    [string]$Notes = "Nuclear Music Player con auto-actualización universal e integración GitHub Releases"
)

$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

$Tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
$ExecutablesDir = "$Root\ejecutables"
$ApkPath = "$ExecutablesDir\nuclear-music-player.apk"
$ExePath = "$ExecutablesDir\Nuclear_1.47.1_x64-setup.exe"

if (-not (Test-Path $ApkPath)) {
    Write-Error "No se encontró el APK en: $ApkPath"
    exit 1
}

if (-not (Test-Path $ExePath)) {
    Write-Error "No se encontró el instalador de Windows en: $ExePath"
    exit 1
}

# Create latest.json for Tauri updater
$cleanVer = $Version.Replace("v", "")
$latestJsonContent = @"
{
  "version": "$cleanVer",
  "notes": "$Notes",
  "pub_date": "$((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"))",
  "platforms": {
    "windows-x86_64": {
      "signature": "",
      "url": "https://github.com/danidetenerife/nucelar/releases/download/$Tag/Nuclear_1.47.1_x64-setup.exe"
    }
  }
}
"@

$LatestJsonPath = "$ExecutablesDir\latest.json"
Set-Content -Path $LatestJsonPath -Value $latestJsonContent -Encoding UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Publicando Release $Tag en GitHub..." -ForegroundColor Green
Write-Host " Archivos a subir:" -ForegroundColor Cyan
Write-Host " - APK: $ApkPath"
Write-Host " - Windows EXE: $ExePath"
Write-Host " - Tauri JSON: $LatestJsonPath"
Write-Host "==========================================================" -ForegroundColor Cyan

# Create release
gh release create $Tag "$ApkPath" "$ExePath" "$LatestJsonPath" --title "Nuclear Player $Tag" --notes "$Notes"

if ($LASTEXITCODE -eq 0) {
    Write-Host "¡Release $Tag publicado exitosamente en GitHub!" -ForegroundColor Green
    Write-Host "URL: https://github.com/danidetenerife/nucelar/releases/tag/$Tag" -ForegroundColor Cyan
} else {
    Write-Host "Subiendo assets al release existente $Tag..." -ForegroundColor Yellow
    gh release upload $Tag "$ApkPath" "$ExePath" "$LatestJsonPath" --clobber
    Write-Host "¡Assets actualizados en el release $Tag!" -ForegroundColor Green
}
