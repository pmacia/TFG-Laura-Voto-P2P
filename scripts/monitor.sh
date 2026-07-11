#!/usr/bin/env bash
# monitor.sh
# Consolida logs si existen o indica cómo ver las terminales donde están los servidores.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"

FOLLOW=false
if [[ "${1:-}" == "--follow" || "${1:-}" == "-f" ]]; then FOLLOW=true; fi

if [[ -d "$LOG_DIR/servers" || -f "$LOG_DIR/client/client.log" ]]; then
  echo "[INFO] Logs detectados en $LOG_DIR"
  if [[ "$FOLLOW" == true ]]; then
    tail -n +1 -f "$LOG_DIR/servers"/*.log "$LOG_DIR/client/client.log" 2>/dev/null || true
  else
    for f in "$LOG_DIR/servers"/*.log; do
      [ -e "$f" ] || continue
      echo -e "\n== $f =="
      tail -n 200 "$f" || true
    done
    if [[ -f "$LOG_DIR/client/client.log" ]]; then
      echo -e "\n== $LOG_DIR/client/client.log =="
      tail -n 200 "$LOG_DIR/client/client.log"
    fi
  fi
else
  echo "[WARN] No hay logs centralizados en $LOG_DIR"
  echo "Puedes usar estas opciones para ver el estado o las terminales donde se lanzaron los procesos:"
  echo "  - Ver procesos: bash scripts/status.sh"
  echo "  - Mostrar procesos Node/NG: ps aux | egrep 'scripts/start-country.js|ng serve|npm start'"
  echo "  - Si los servidores se lanzaron en ventanas de Terminal/gnome-terminal, revisa esas ventanas."
fi
