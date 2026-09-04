#!/usr/bin/env bash
# aurora_diagnose.sh
#
# Diagnóstico completo de la app Aurora (com.nuclearplayer.app) vía ADB.
# Ejecútalo en tu PC (no en el móvil) con el teléfono conectado y
# depuración USB autorizada.
#
# Uso:
#   chmod +x aurora_diagnose.sh
#   ./aurora_diagnose.sh
#
# Genera una carpeta ./aurora_diag_<timestamp>/ con todos los reports.
# Cuando termine, pásame el contenido de esa carpeta (o los archivos
# que más te interesen) y te digo qué está pasando exactamente.

set -euo pipefail

PKG="com.nuclearplayer.app"
TS=$(date +%Y%m%d_%H%M%S)
OUTDIR="aurora_diag_${TS}"
mkdir -p "$OUTDIR"

echo "== Aurora diagnostics =="
echo "Paquete: $PKG"
echo "Salida:  $OUTDIR/"
echo

# --- 0. Verificar dispositivo conectado ---
if ! adb get-state >/dev/null 2>&1; then
  echo "ERROR: no hay ningún dispositivo ADB conectado/autorizado."
  exit 1
fi
adb devices -l > "$OUTDIR/00_device.txt"

# --- 1. Info básica de la app instalada ---
echo "[1/7] Volcando info del paquete (versión, permisos, dex count)..."
adb shell dumpsys package "$PKG" > "$OUTDIR/01_package_info.txt" || true

# --- 2. Reset de batterystats para medir limpio ---
echo "[2/7] Reseteando estadísticas de batería (adb requiere USB, no cargando)..."
adb shell dumpsys batterystats --reset >/dev/null 2>&1 || \
  echo "  (aviso: si el teléfono está cargando por USB, batterystats no acumula bien; desconecta la carga y deja solo datos si puedes)"

# --- 3. Logcat en foreground, filtrado a lo relevante ---
echo "[3/7] Iniciando captura de logcat filtrado."
echo "      Ahora: abre la app, reproduce algo, prueba el widget,"
echo "      y simula/recibe una llamada real mientras suena música."
echo "      Pulsa Ctrl+C aquí cuando termines de reproducir la app."
echo

adb logcat -c  # limpia buffer previo
adb logcat \
  "AudioManager:*" "AudioFocus:*" "MediaSession*:*" "MediaSessionService:*" \
  "AppWidget*:*" "Cast*:*" "MediaRouter:*" "chromium:*" "CapacitorHttp:*" \
  "ActivityManager:E" "System.err:*" \
  "$PKG:*" "*:S" \
  | tee "$OUTDIR/02_logcat_filtered.txt" || true

echo
echo "[4/7] Volcando dumpsys de media session..."
adb shell dumpsys media_session > "$OUTDIR/03_media_session.txt" || true

echo "[5/7] Volcando dumpsys de widgets..."
adb shell dumpsys appwidget > "$OUTDIR/04_appwidget.txt" || true

echo "[6/7] Volcando batterystats acumulado desde el reset..."
adb shell dumpsys batterystats "$PKG" > "$OUTDIR/05_batterystats.txt" || true
# Versión completa por si quieres abrirla en Battery Historian
# (https://developer.android.com/topic/performance/power/battery-historian)
adb shell dumpsys batterystats > "$OUTDIR/05_batterystats_full.txt" || true

echo "[7/7] Volcando CPU/top y wakelocks activos..."
adb shell dumpsys cpuinfo > "$OUTDIR/06_cpuinfo.txt" || true
adb shell dumpsys power > "$OUTDIR/07_power_wakelocks.txt" || true
adb shell dumpsys alarm | grep -A 20 "$PKG" > "$OUTDIR/08_alarms.txt" || true

echo
echo "Listo. Revisa la carpeta $OUTDIR/"
echo
echo "PASO MANUAL COMPLEMENTARIO (imprescindible para un WebView/Capacitor):"
echo "  1. En Chrome (desktop) abre: chrome://inspect/#devices"
echo "  2. Con el móvil conectado y la app abierta, deberías ver el WebView"
echo "     de Aurora listado. Click 'inspect'."
echo "  3. Pestaña Console: mira errores JS al reproducir/pausar/llamar."
echo "  4. Pestaña Performance: graba mientras reproduces audio 30s en"
echo "     background — verás si hay JS ejecutándose innecesariamente"
echo "     con la pantalla apagada (consume batería igual)."
echo "  5. Pestaña Network: confirma si hay peticiones repetidas/polling"
echo "     (p.ej. el widget consultando estado por HTTP en vez de push)."
echo
echo "Cuando tengas todo, pásame:"
echo "  - 02_logcat_filtered.txt (el más importante para los 3 bugs)"
echo "  - 05_batterystats.txt (para el análisis de batería)"
echo "  - Capturas o el HAR/trace del chrome://inspect si algo te llama la atención"
