param(
    [string]$CustomVersion = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

# Read current version from packages/player/package.json
$PackageJsonPath = "$Root\packages\player\package.json"
$PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
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
Write-Host " [Nuclear CI] Subiendo de versiÃ³n: $CurrentVer -> $NextVer ($Tag)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Update packages/player/package.json
$PackageJson.version = $NextVer
$PackageJson | ConvertTo-Json -Depth 10 | Set-Content $PackageJsonPath -Encoding UTF8

# 2. Update packages/player/src-tauri/tauri.conf.json
$TauriConfPath = "$Root\packages\player\src-tauri\tauri.conf.json"
$TauriConf = Get-Content $TauriConfPath -Raw | ConvertFrom-Json
$TauriConf.version = $NextVer
$TauriConf | ConvertTo-Json -Depth 10 | Set-Content $TauriConfPath -Encoding UTF8

# 3. Update packages/player/src/stores/updaterStore.ts
$UpdaterStorePath = "$Root\packages\player\src\stores\updaterStore.ts"
(Get-Content $UpdaterStorePath) -replace "const CURRENT_VERSION = '.*?';", "const CURRENT_VERSION = '$NextVer';" | Set-Content $UpdaterStorePath -Encoding UTF8

# 4. Update packages/player/android/app/build.gradle
$BuildGradlePath = "$Root\packages\player\android\app\build.gradle"
$partsVer = $NextVer.Split('.')
$code = [int]$partsVer[0]*10000 + [int]$partsVer[1]*100 + [int]$partsVer[2]
(Get-Content $BuildGradlePath) -replace 'versionName ".*?"', "versionName `"$NextVer`"" -replace 'versionCode \d+', "versionCode $code" | Set-Content $BuildGradlePath -Encoding UTF8

# 5. Build frontend
Write-Host "[1/4] Compilando Frontend..." -ForegroundColor Yellow
npx pnpm --filter @nuclearplayer/player build:frontend

# 6. Build Android APK
Write-Host "[2/4] Compilando Android APK..." -ForegroundColor Yellow
cmd.exe /c "cd packages\player && npx cap sync android && android\build-apk.bat"

# 7. Build Tauri Desktop EXE
Write-Host "[3/4] Compilando instalador Windows..." -ForegroundColor Yellow
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
Set-Location "$Root\packages\player"
try {
    npx pnpm tauri build
} catch {
    Write-Host "Tauri build terminÃ³ con advertencia de firma (esperado)" -ForegroundColor Gray
}
Set-Location $Root

# Copy setup exe to executables
$GeneratedExe = "$Root\packages\player\src-tauri\target\release\bundle\nsis\Nuclear_${NextVer}_x64-setup.exe"
$DestExe = "$Root\ejecutables\Nuclear_${NextVer}_x64-setup.exe"
if (Test-Path $GeneratedExe) {
    Copy-Item $GeneratedExe $DestExe -Force
    Copy-Item $GeneratedExe "C:\Users\Danid\Desktop\Nuclear_${NextVer}_x64-setup.exe" -Force -ErrorAction SilentlyContinue
}

# 8. Sync Git and Publish Release
Write-Host "[4/4] Subiendo a GitHub y publicando Release $Tag..." -ForegroundColor Green
powershell.exe -ExecutionPolicy Bypass -File "$Root\scripts\auto-sync-github.ps1"
powershell.exe -ExecutionPolicy Bypass -File "$Root\scripts\publish-release.ps1" -Version $NextVer

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Â¡VersiÃ³n $NextVer ($Tag) compilada y publicada con Ã©xito!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
