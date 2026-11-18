#!/bin/bash
# Keep-alive del preview integrado FarmaFácil en :3070.
# Sobrevive al cierre de shells de agentes: pensado para LaunchAgent / nohup.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/tmp"
LOG="$LOG_DIR/next-3070.log"
PID_FILE="$LOG_DIR/next-3070.pid"
META_FILE="$LOG_DIR/next-3070.meta"
PORT=3070
HOST=0.0.0.0
HEALTH="http://127.0.0.1:${PORT}/login"
POLL_SECS=20

mkdir -p "$LOG_DIR"
cd "$ROOT" || exit 1

write_meta() {
  local pid="$1"
  {
    echo "pid=$pid"
    echo "cwd=$ROOT"
    echo "branch=$(git -C "$ROOT" branch --show-current 2>/dev/null || true)"
    echo "commit=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
    echo "short=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || true)"
    echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "app_url_env=$(grep -E '^NEXT_PUBLIC_APP_URL=' .env.local 2>/dev/null | head -1 | cut -d= -f2-)"
  } >"$META_FILE"
}

is_listening() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

health_ok() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH" || echo 000)
  [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "302" ]
}

start_server() {
  # Liberar puerto si hay listener zombie
  local old
  old=$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "${old:-}" ]; then
    kill $old 2>/dev/null || true
    sleep 1
    kill -9 $old 2>/dev/null || true
  fi

  : >>"$LOG"
  echo "==== keepalive restart $(date -u +%Y-%m-%dT%H:%M:%SZ) ====" >>"$LOG"

  # PRE-05C: origen coherente con E2E (127.0.0.1). skipMiddlewareUrlNormalize
  # está en next.config.js; no hace falta el env __NEXT_* aquí.
  export APP_URL="http://127.0.0.1:${PORT}"
  export NEXT_PUBLIC_APP_URL="http://127.0.0.1:${PORT}"
  export FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN="${FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN:-1}"

  # setsid (si existe) desacopla del grupo de señales del launcher
  if command -v setsid >/dev/null 2>&1; then
    setsid env APP_URL="$APP_URL" NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
      FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN="$FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN" \
      node --env-file=.env.staging.local ./node_modules/next/dist/bin/next dev -H "$HOST" -p "$PORT" >>"$LOG" 2>&1 &
  else
    nohup env APP_URL="$APP_URL" NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
      FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN="$FF_COMMERCIAL_QUOTE_EMAIL_DRY_RUN" \
      node --env-file=.env.staging.local ./node_modules/next/dist/bin/next dev -H "$HOST" -p "$PORT" >>"$LOG" 2>&1 &
  fi
  local pid=$!
  echo "$pid" >"$PID_FILE"
  write_meta "$pid"

  # Esperar readiness
  local i
  for i in $(seq 1 30); do
    if is_listening && health_ok; then
      echo "started pid=$pid ok" >>"$LOG"
      return 0
    fi
    sleep 1
  done
  echo "start_timeout pid=$pid" >>"$LOG"
  return 1
}

# Bucle watchdog
while true; do
  if is_listening && health_ok; then
    # Refrescar meta si falta
    if [ ! -f "$META_FILE" ]; then
      pid=$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1 || true)
      [ -n "${pid:-}" ] && write_meta "$pid"
    fi
  else
    echo "unhealthy at $(date -u +%Y-%m-%dT%H:%M:%SZ) — restarting" >>"$LOG"
    start_server || true
  fi
  sleep "$POLL_SECS"
done
