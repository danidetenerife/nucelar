param(
    [string]$Version = "1.47.1",
    [string]$Notes = "Aurora Music Player con reproducción fluida en segundo plano, sincronización PC-móvil y auto-actualizador universal."
)

$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

$Tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
$cleanVer = $Version.Replace("v", "")
$ExecutablesDir = "$Root\ejecutables"

# Support Aurora naming with Nuclear fallback
$ApkPath = "$ExecutablesDir\aurora-music-player.apk"
if (-not (Test-Path $ApkPath)) {
    $ApkPath = "$ExecutablesDir\nuclear-music-player.apk"
}

$ExePath = "$ExecutablesDir\Aurora_${cleanVer}_x64-setup.exe"
if (-not (Test-Path $ExePath)) {
    $ExePath = "$ExecutablesDir\Nuclear_${cleanVer}_x64-setup.exe"
}

$SignaturePath = "$Root\packages\player\src-tauri\target\release\bundle\nsis\Aurora_${cleanVer}_x64-setup.exe.sig"
if (-not (Test-Path -LiteralPath $SignaturePath)) {
    $SignaturePath = "$Root\packages\player\src-tauri\target\release\bundle\nsis\Nuclear_${cleanVer}_x64-setup.exe.sig"
}

if (-not (Test-Path $ExePath)) {
    $fallbackExe = Get-ChildItem -Path $ExecutablesDir -Filter "*setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($fallbackExe) {
        $ExePath = $fallbackExe.FullName
    }
}

if (-not (Test-Path $ApkPath)) {
    Write-Error "No se encontró el APK en: $ApkPath"
    exit 1
}

if (-not (Test-Path $ExePath)) {
    Write-Error "No se encontró el instalador de Windows en: $ExePath"
    exit 1
}

if (-not (Test-Path -LiteralPath $SignaturePath)) {
    Write-Error "No se encontró la firma del actualizador para $cleanVer"
    exit 1
}

$exeFileName = [System.IO.Path]::GetFileName($ExePath)
$signature = [System.IO.File]::ReadAllText($SignaturePath).Trim()
if ([string]::IsNullOrWhiteSpace($signature)) {
    Write-Error "La firma del actualizador está vacía"
    exit 1
}

# Create latest.json for Tauri updater
$latestJsonContent = @"
{
  "version": "$cleanVer",
  "notes": "$Notes",
  "pub_date": "$((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"))",
  "platforms": {
    "windows-x86_64": {
      "signature": "$signature",
      "url": "https://github.com/danidetenerife/nucelar/releases/download/$Tag/$exeFileName"
    }
  }
}
"@

$LatestJsonPath = "$ExecutablesDir\latest.json"
[System.IO.File]::WriteAllText($LatestJsonPath, $latestJsonContent, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Publicando Release $Tag en GitHub..." -ForegroundColor Green
Write-Host " Archivos a subir:" -ForegroundColor Cyan
Write-Host " - APK: $ApkPath"
Write-Host " - Windows EXE: $ExePath"
Write-Host " - Firma del actualizador: $SignaturePath"
Write-Host " - Tauri JSON: $LatestJsonPath"
Write-Host "==========================================================" -ForegroundColor Cyan

# Create release
gh release create $Tag "$ApkPath" "$ExePath" "$SignaturePath" "$LatestJsonPath" --title "Aurora Music Player $Tag" --notes "$Notes"

if ($LASTEXITCODE -eq 0) {
    Write-Host "¡Release $Tag publicado exitosamente en GitHub!" -ForegroundColor Green
    Write-Host "URL: https://github.com/danidetenerife/nucelar/releases/tag/$Tag" -ForegroundColor Cyan
} else {
    Write-Host "Subiendo assets al release existente $Tag..." -ForegroundColor Yellow
    gh release upload $Tag "$ApkPath" "$ExePath" "$SignaturePath" "$LatestJsonPath" --clobber
    Write-Host "¡Assets actualizados en el release $Tag!" -ForegroundColor Green
}
