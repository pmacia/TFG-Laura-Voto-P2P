#!/usr/bin/env bash
# start-everything.sh
# Script para lanzar todo el entorno del proyecto con mínima intervención.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$REPO_ROOT/server"
CLIENT_DIR="$REPO_ROOT/client"
LOG_DIR="$REPO_ROOT/logs"

NO_SETUP=false
NO_CLIENT=false
NO_SERVERS=false
START_MONGO=false
USE_LOGS=false

usage() {
  cat <<USAGE
Usage: $0 [--no-setup] [--no-servers] [--no-client] [--start-mongo] [--logs]

Options:
  --no-setup     No ejecutar el script de setup (saltará generación de claves y seed)
  --no-servers   No arrancar los servidores de país
  --no-client    No arrancar el cliente
  --start-mongo  Intentar arrancar un contenedor Docker MongoDB si no hay conexión
  --logs         Crear logs centralizados en ./logs/ (en lugar de abrir terminales gráficas)

Este script muestra mensajes claros sobre cada paso y deja logs en ./logs/
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --no-setup) NO_SETUP=true ;;
    --no-client) NO_CLIENT=true ;;
    --no-servers) NO_SERVERS=true ;;
    --start-mongo) START_MONGO=true ;;
    --logs) USE_LOGS=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $arg"; usage; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"

log() { echo -e "[INFO] $1"; }
ok() { echo -e "[OK] $1"; }
warn() { echo -e "[WARN] $1"; }
err() { echo -e "[ERROR] $1"; }

check_mongo() {
  if command -v mongosh >/dev/null 2>&1; then
    if mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      ok "MongoDB disponible (mongosh)"
      return 0
    fi
  fi
  if command -v mongo >/dev/null 2>&1; then
    if mongo --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      ok "MongoDB disponible (mongo)"
      return 0
    fi
  fi
  return 1
}

try_start_mongo_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker no disponible: no puedo arrancar MongoDB automáticamente"
    return 1
  fi
  if docker ps --filter "name=tfg-mongo" --format '{{.Names}}' | grep -q tfg-mongo; then
    ok "Contenedor tfg-mongo ya en ejecución"
    return 0
  fi
  warn "Intentando arrancar MongoDB en Docker (contenedor 'tfg-mongo')..."
  docker run -d --name tfg-mongo -p 27017:27017 -v tfg_mongo_data:/data/db mongo:6.0 >/dev/null
  sleep 2
  if check_mongo; then
    ok "MongoDB arrancado en Docker"
    return 0
  fi
  err "No se pudo arrancar MongoDB en Docker"
  return 1
}

open_terminal_cmd() {
  # args: title command cwd
  local title="$1"; shift
  local command="$1"; shift
  local cwd="$1"; shift

  if [[ "$OSTYPE" == darwin* ]]; then
    osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "cd '$cwd' && $command"
end tell
APPLESCRIPT
  else
    if command -v gnome-terminal >/dev/null 2>&1; then
      gnome-terminal --title "$title" -- bash -lc "cd '$cwd' && $command; exec bash" &
    elif command -v xfce4-terminal >/dev/null 2>&1; then
      xfce4-terminal --title "$title" --command="bash -lc 'cd \"$cwd\" && $command; exec bash'" &
    elif command -v konsole >/dev/null 2>&1; then
      konsole --new-tab -p tabtitle="$title" -e bash -lc "cd '$cwd' && $command; exec bash" &
    else
      # Fallback: ejecutar en background y escribir log
      bash -lc "cd '$cwd' && $command" &
    fi
  fi
}

main() {
  log "Iniciando start-everything (raíz: $REPO_ROOT)"

  # 1) Comprobar MongoDB
  if check_mongo; then
    :
  else
    warn "MongoDB no responde en localhost:27017"
    if [[ "$START_MONGO" == true ]]; then
      try_start_mongo_docker || warn "Continuando aun sin MongoDB disponible"
    else
      warn "Si quieres que intente arrancar MongoDB en Docker ejecuta con --start-mongo"
    fi
  fi

  # 2) Setup (generar claves, seed, etc.)
  if [[ "$NO_SETUP" == false ]]; then
    log "Ejecutando setup completo del servidor (generación de claves y seed)"
    bash "$SERVER_DIR/scripts/setup-all.sh"
    ok "Setup completado"
  else
    log "Omitiendo setup por --no-setup"
  fi

  # 3) Arrancar servidores de país
  if [[ "$NO_SERVERS" == false ]]; then
    log "Arrancando servidores de país"
    if [[ "$USE_LOGS" == true ]]; then
      warn "--logs: Forzando logs centralizados (sin terminales gráficas)"
      mkdir -p "$LOG_DIR/servers"
      for c in es fr de pt it; do
        scriptname="dev:$c"
        log "  Lanzando $c -> npm run $scriptname"
        ( cd "$SERVER_DIR" && npm run "$scriptname" > "$LOG_DIR/servers/server-$c.log" 2>&1 ) &
      done
      ok "Servidores arrancados en background; logs en $LOG_DIR/servers/"
    elif bash "$SCRIPT_DIR/start-all-countries.sh"; then
      ok "Intentado abrir servidores en terminales (si tu entorno gráfico lo permite)"
    else
      warn "No se pudo abrir terminales gráficas; arrancando servidores en background"
      mkdir -p "$LOG_DIR/servers"
      for c in es fr de pt it; do
        scriptname="dev:$c"
        log "  Lanzando $c -> npm run $scriptname"
        ( cd "$SERVER_DIR" && npm run "$scriptname" > "$LOG_DIR/servers/server-$c.log" 2>&1 ) &
      done
      ok "Servidores arrancados en background; logs en $LOG_DIR/servers/"
    fi
  else
    log "Omitiendo arranque de servidores por --no-servers"
  fi

  # 4) Arrancar cliente
  if [[ "$NO_CLIENT" == false ]]; then
    log "Arrancando cliente Angular"
    mkdir -p "$LOG_DIR/client"
    # Si USE_LOGS activo o no se pueden abrir terminales, ejecutar en background con logs
    if [[ "$USE_LOGS" == true ]]; then
      warn "--logs: Forzando logs centralizados (sin terminal gráfica)"
      bash -lc "cd '$CLIENT_DIR' && npm start" > "$LOG_DIR/client/client.log" 2>&1 &
      ok "Cliente arrancado en background; log en $LOG_DIR/client/client.log"
    elif [[ "$OSTYPE" == darwin* ]] || command -v gnome-terminal >/dev/null 2>&1 || command -v xfce4-terminal >/dev/null 2>&1; then
      open_terminal_cmd "Cliente" "npm start" "$CLIENT_DIR"
      ok "Cliente solicitado en nueva terminal (o lanzado en background por fallback)"
    else
      bash -lc "cd '$CLIENT_DIR' && npm start" > "$LOG_DIR/client/client.log" 2>&1 &
      ok "Cliente arrancado en background; log en $LOG_DIR/client/client.log"
    fi
  else
    log "Omitiendo arranque del cliente por --no-client"
  fi

  echo ""
  log "Proceso finalizado. Revisa logs en: $LOG_DIR"
  log "Servidores: http://localhost:3001 .. 3005"
  log "Cliente: http://localhost:4200 (si 'npm start' se lanzó correctamente)"
}

main "$@"
