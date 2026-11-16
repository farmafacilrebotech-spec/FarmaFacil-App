#!/usr/bin/env bash
# Túnel HTTPS efímero (Cloudflare Quick Tunnel) → :3070
# Solo pruebas PWA. No toca producción. URL cambia en cada arranque.
# protocol http2: más estable que quic en este entorno (evita 530).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p tmp

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Falta cloudflared (brew install cloudflared)"
  exit 1
fi

code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3070/login || true)"
if [[ "$code" != "200" ]]; then
  echo "ERROR: 3070 no responde (login=$code). Arranca la app antes."
  exit 1
fi

if [[ -f tmp/https-pwa.pid ]]; then
  old="$(cat tmp/https-pwa.pid || true)"
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    echo "Túnel ya activo pid=$old"
    [[ -f tmp/https-pwa.url ]] && cat tmp/https-pwa.url
    exit 0
  fi
fi

: > tmp/https-pwa.log
nohup cloudflared tunnel --url http://127.0.0.1:3070 --protocol http2 --no-autoupdate \
  >> tmp/https-pwa.log 2>&1 &
echo $! > tmp/https-pwa.pid

url=""
for i in $(seq 1 45); do
  url="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' tmp/https-pwa.log | head -1 || true)"
  if [[ -n "$url" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$url" ]]; then
  echo "No se obtuvo URL trycloudflare.com. Ver tmp/https-pwa.log"
  exit 1
fi

printf '%s\n' "$url" > tmp/https-pwa.url
echo "HTTPS PWA (pruebas): $url"
echo "Login: $url/login"
echo "QR Fase7: $url/e/2mo6cq0yjss6ratr"
echo "pid=$(cat tmp/https-pwa.pid) — para parar: kill \$(cat tmp/https-pwa.pid)"
echo "Nota: Quick Tunnel sin uptime guarantee; reiniciar si Cloudflare 530."
