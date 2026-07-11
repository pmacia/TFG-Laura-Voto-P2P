#!/usr/bin/env bash
# start-all-countries.sh
# Versión shell del script de PowerShell para macOS y Ubuntu.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"

COUNTRIES=(
  "España:dev:es"
  "Francia:dev:fr"
  "Alemania:dev:de"
  "Portugal:dev:pt"
  "Italia:dev:it"
)

URLS=(
  "http://localhost:3001"
  "http://localhost:3002"
  "http://localhost:3003"
  "http://localhost:3004"
  "http://localhost:3005"
)

open_terminal() {
  local title="$1"
  local command="$2"

  if [[ "$OSTYPE" == darwin* ]]; then
    # Para macOS, usar osascript para abrir newTab en Terminal
    osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  set newWindow to (do script "cd '$SERVER_DIR' && $command")
end tell
APPLESCRIPT
  else
    if command -v gnome-terminal >/dev/null 2>&1; then
      gnome-terminal -- bash -lc "cd '$SERVER_DIR' && $command; exec bash" &
    elif command -v xfce4-terminal >/dev/null 2>&1; then
      xfce4-terminal --title "$title" --command="bash -lc 'cd \"$SERVER_DIR\" && $command; exec bash'" &
    elif command -v konsole >/dev/null 2>&1; then
      konsole --new-tab -p tabtitle="$title" -e bash -lc "cd '$SERVER_DIR' && $command; exec bash" &
    elif command -v xterm >/dev/null 2>&1; then
      xterm -T "$title" -e "bash -lc 'cd \"$SERVER_DIR\" && $command; exec bash'" &
    else
      echo "No se encontró un emulador de terminal compatible. Ejecuta manualmente desde $SERVER_DIR: $command"
    fi
  fi
}

open_url() {
  local url="$1"
  if [[ "$OSTYPE" == darwin* ]]; then
    open "$url"
  else
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$url" >/dev/null 2>&1 || true
    elif command -v gnome-open >/dev/null 2>&1; then
      gnome-open "$url" >/dev/null 2>&1 || true
    else
      echo "Abre manualmente la URL: $url"
    fi
  fi
}

main() {
  echo "Iniciando servidores de países en nuevas terminales..."

  for country in "${COUNTRIES[@]}"; do
    IFS=":" read -r name script command <<< "$country"
    open_terminal "País - $name" "npm run $script:$command"
    sleep 0.5
  done

  echo "Esperando a que los servidores se inicien..."
  sleep 5

  for url in "${URLS[@]}"; do
    open_url "$url"
  done

  echo "Listo."
}

main "$@"
