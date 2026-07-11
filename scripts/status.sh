#!/usr/bin/env bash
# status.sh
# Muestra el estado del entorno: procesos, puertos y health checks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[INFO] Estado de procesos relevantes (buscar 'start-country', 'ng serve', 'npm start')"
ps aux | egrep "scripts/start-country.js|ng serve|npm start" | egrep -v "egrep|status.sh" || true

echo "\n[INFO] Puertos escuchando (3001-3005, 4200):"
ss -ltnp 2>/dev/null | egrep ":(3001|3002|3003|3004|3005|4200)\b" || lsof -iTCP -sTCP:LISTEN -P -n | egrep ":(3001|3002|3003|3004|3005|4200)\b" || true

echo "\n[INFO] Health checks (GET /) de servidores (3001..3005):"
for p in 3001 3002 3003 3004 3005; do
  status="no response"
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:$p/ >/dev/null 2>&1; then
    status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$p/ 2>/dev/null)
  fi
  echo "  http://localhost:$p/ -> $status"
done

echo "\n[INFO] Cliente (4200):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/ >/dev/null 2>&1; then
  echo "  http://localhost:4200/ -> $(curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/)"
else
  echo "  http://localhost:4200/ -> no response"
fi

echo "\n[INFO] Repositorio: $REPO_ROOT"
