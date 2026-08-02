#!/usr/bin/env bash
# AI Video Stüdyosu — tek komutla yerel başlatma (macOS/Linux)
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "HATA: pnpm bulunamadı. Node.js 20+ kurun, sonra: corepack enable" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Bağımlılıklar kuruluyor (ilk çalıştırmada birkaç dakika sürer)..."
  pnpm install
fi

echo "Paketler derleniyor..."
pnpm turbo run build

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

pnpm --filter @studio/api dev &
pnpm --filter @studio/web dev &

echo
echo "API + Web başlatıldı. Hazır olunca tarayıcıda açın: http://localhost:3000"
echo "Durdurmak için: Ctrl+C"
wait
