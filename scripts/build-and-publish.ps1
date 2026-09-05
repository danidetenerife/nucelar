param(
    [string]$CustomVersion = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Read current version from packages/player/package.json
$PackageJsonPath = "$Root\packages\player\package.json"
$rawPkg = [System.IO.File]::ReadAllText($PackageJsonPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$PackageJson = $rawPkg | ConvertFrom-Json
$CurrentVer = $PackageJson.version

# Compute next version
if ($CustomVersion -ne "") {
    $NextVer = $CustomVersion.Replace("v", "")
} else {
    $parts = $CurrentVer.Split('.')
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2] + 1
    $NextVer = "$major.$minor.$patch"
}

$Tag = "v$NextVer"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Aurora CI] Subiendo de versión: $CurrentVer -> $NextVer ($Tag)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Update packages/player/package.json
$PackageJson.version = $NextVer
$pkgStr = ($PackageJson | ConvertTo-Json -Depth 10)
[System.IO.File]::WriteAllText($PackageJsonPath, $pkgStr, $utf8NoBom)

# 2. Update packages/player/src-tauri/tauri.conf.json
$TauriConfPath = "$Root\packages\player\src-tauri\tauri.conf.json"
$rawTauri = [System.IO.File]::ReadAllText($TauriConfPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$TauriConf = $rawTauri | ConvertFrom-Json
$TauriConf.version = $NextVer
$tauriStr = ($TauriConf | ConvertTo-Json -Depth 10)
[System.IO.File]::WriteAllText($TauriConfPath, $tauriStr, $utf8NoBom)

# 3. Update packages/player/src/stores/updaterStore.ts
$UpdaterStorePath = "$Root\packages\player\src\stores\updaterStore.ts"
$rawUpdater = [System.IO.File]::ReadAllText($UpdaterStorePath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$updaterStr = $rawUpdater -replace "const CURRENT_VERSION = '.*?';", "const CURRENT_VERSION = '$NextVer';"
[System.IO.File]::WriteAllText($UpdaterStorePath, $updaterStr, $utf8NoBom)

# 4. Update packages/player/android/app/build.gradle
$BuildGradlePath = "$Root\packages\player\android\app\build.gradle"
$rawGradle = [System.IO.File]::ReadAllText($BuildGradlePath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$partsVer = $NextVer.Split('.')
$code = [int]$partsVer[0]*10000 + [int]$partsVer[1]*100 + [int]$partsVer[2]
$gradleStr = $rawGradle -replace 'versionName ".*?"', "versionName `"$NextVer`"" -replace 'versionCode \d+', "versionCode $code"
[System.IO.File]::WriteAllText($BuildGradlePath, $gradleStr, $utf8NoBom)

# 5. Build frontend
Write-Host "[1/4] Compilando Frontend..." -ForegroundColor Yellow
npx pnpm --filter @nuclearplayer/player build:frontend

# 6. Build Android APK
Write-Host "[2/4] Compilando Android APK..." -ForegroundColor Yellow
cmd.exe /c "cd packages\player && npx cap sync android && android\build-apk.bat"

# 7. Build Tauri Desktop EXE
Write-Host "[3/4] Compilando instalador Windows..." -ForegroundColor Yellow
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
$SigningKeyPath = Join-Path $env:USERPROFILE ".tauri\nuclear-updater.key"
$SigningPasswordPath = Join-Path $env:USERPROFILE ".tauri\nuclear-updater.password"

if (-not (Test-Path -LiteralPath $SigningKeyPath) -or -not (Test-Path -LiteralPath $SigningPasswordPath)) {
    throw "No se encontró la clave de firma del actualizador en $SigningKeyPath"
}

$env:TAURI_SIGNING_PRIVATE_KEY = [System.IO.File]::ReadAllText($SigningKeyPath).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.IO.File]::ReadAllText($SigningPasswordPath).Trim()
Set-Location "$Root\packages\player"
pnpm tauri build
if ($LASTEXITCODE -ne 0) {
    throw "La compilación firmada de escritorio ha fallado."
}
Set-Location $Root

# Copy setup exe to executables
$GeneratedExe = "$Root\packages\player\src-tauri\target\release\bundle\nsis\Aurora_${NextVer}_x64-setup.exe"
if (-not (Test-Path $GeneratedExe)) {
    $GeneratedExe = "$Root\packages\player\src-tauri\target\release\bundle\nsis\Nuclear_${NextVer}_x64-setup.exe"
}
$DestExe = "$Root\ejecutables\Aurora_${NextVer}_x64-setup.exe"
if (Test-Path $GeneratedExe) {
    Copy-Item $GeneratedExe $DestExe -Force
    Copy-Item $GeneratedExe "C:\Users\Danid\Desktop\Aurora_${NextVer}_x64-setup.exe" -Force -ErrorAction SilentlyContinue
}

$GeneratedSignature = "$GeneratedExe.sig"
if (-not (Test-Path -LiteralPath $GeneratedSignature)) {
    throw "No se generó la firma del actualizador de escritorio."
}

# 8. Sync Git and Publish Release
Write-Host "[4/4] Subiendo a GitHub y publicando Release $Tag..." -ForegroundColor Green
powershell.exe -ExecutionPolicy Bypass -File "$Root\scripts\auto-sync-github.ps1"
powershell.exe -ExecutionPolicy Bypass -File "$Root\scripts\publish-release.ps1" -Version $NextVer

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " ¡Versión $NextVer ($Tag) compilada y publicada con éxito!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
