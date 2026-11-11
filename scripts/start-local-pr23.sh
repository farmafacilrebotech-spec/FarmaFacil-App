#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:3023}"
export APP_URL="${APP_URL:-http://127.0.0.1:3023}"
export NEXT_PUBLIC_FF_POSTER_PDF_LOCAL=1
PORT="${PORT:-3023}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Already listening on $PORT"
  curl -s -o /dev/null -w "login=%{http_code}\n" "http://127.0.0.1:${PORT}/login" || true
  exit 0
fi
echo "Starting PR #23 on 0.0.0.0:${PORT} (staging + poster local)"
exec node --env-file=.env.local ./node_modules/next/dist/bin/next dev -H 0.0.0.0 -p "$PORT"
