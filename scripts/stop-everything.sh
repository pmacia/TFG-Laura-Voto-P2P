#!/usr/bin/env bash
# stop-everything.sh
# Modo seguro por defecto: muestra qué procesos eliminaría y pide confirmación.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FORCE=false
STOP_MONGO=false
while [[ ${1:-} != "" ]]; do
  case "$1" in
    --yes|-y) FORCE=true; shift ;;
    --stop-mongo) STOP_MONGO=true; shift ;;
    -h|--help) echo "Usage: $0 [--yes] [--stop-mongo]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

echo "[INFO] Buscando procesos relacionados con el proyecto..."

stop_mongo_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "[WARN] Docker no disponible: no puedo detener MongoDB automáticamente"
    return 1
  fi

  if docker ps --filter "name=tfg-mongo" --format '{{.Names}}' | grep -q tfg-mongo; then
    echo "[INFO] Deteniendo contenedor MongoDB 'tfg-mongo'..."
    docker stop tfg-mongo >/dev/null 2>&1
    echo "[OK] Contenedor 'tfg-mongo' detenido"
    return 0
  fi

  if docker ps -a --filter "name=tfg-mongo" --format '{{.Names}}' | grep -q tfg-mongo; then
    echo "[INFO] El contenedor 'tfg-mongo' ya estaba parado"
    return 0
  fi

  echo "[WARN] No se encontró el contenedor Docker 'tfg-mongo'"
  return 1
}

# Encontrar nodos que ejecuten scripts/start-country.js dentro del repo
pids_to_kill=()
while IFS= read -r pid; do pids_to_kill+=("$pid"); done < <(pgrep -f "scripts/start-country.js" || true)

# Encontrar procesos npm/ng del cliente (ng serve / npm start en client)
while IFS= read -r pid; do pids_to_kill+=("$pid"); done < <(pgrep -f "ng serve" || true)
while IFS= read -r pid; do pids_to_kill+=("$pid"); done < <(pgrep -f "npm start" || true)

if [[ ${#pids_to_kill[@]} -eq 0 ]]; then
  echo "[INFO] No se encontraron procesos para detener."
  if [[ "$STOP_MONGO" == true ]]; then
    stop_mongo_docker || echo "[WARN] No se pudo detener MongoDB con Docker"
  fi
  exit 0
fi

echo "Encontrados procesos:" 
for pid in "${pids_to_kill[@]}"; do ps -p "$pid" -o pid,user,cmd || true; done

if [[ "$FORCE" != true ]]; then
  read -p "¿Deseas detener estos procesos? Escribe 'sí' para confirmar: " ans
  if [[ "$ans" != "sí" ]]; then
    echo "Cancelado por el usuario.";
    exit 0
  fi
fi

echo "Deteniendo procesos..."
for pid in "${pids_to_kill[@]}"; do
  if kill -TERM "$pid" 2>/dev/null; then
    echo "  PID $pid enviado SIGTERM"
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
      echo "  PID $pid forzado con SIGKILL"
    fi
  fi
done

if [[ "$STOP_MONGO" == true ]]; then
  stop_mongo_docker || echo "[WARN] No se pudo detener MongoDB con Docker"
fi

echo "[OK] Procesos detenidos."
