#!/usr/bin/env bash
# Gate local obligatorio antes de publicar (post baseline 2026-11-16).
# Uso: npm run validate:release
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:3070}"
echo "== validate:release =="
echo "base: $BASE_URL"
echo "cwd:  $ROOT"
echo "head: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/login" || true)"
if [[ "$code" != "200" ]]; then
  echo "ERROR: $BASE_URL/login → HTTP $code (arranca daemon 3070 en modo prod)"
  exit 1
fi

npm run test:e2e:prepare
npm run test:e2e:full

echo
echo "== post-e2e: modo manual emails (no dry-run) =="
node scripts/assert-corporate-email-manual-mode.mjs

echo
echo "OK validate:release — suite global verde. Conserva playwright-report/ y tmp/e2e-results.json."
echo "Servidor 3070 debe permanecer en envío real allowlist (FF_CORPORATE_EMAIL_DRY_RUN=0)."
