#!/usr/bin/env bash
# clean-all.sh
# Script para limpiar completamente las BDs de todos los países (DESTRUCTIVO)
# Úsalo solo para test/reset del sistema
# Uso: bash scripts/clean-all.sh

set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

# Verificar ubicación
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ ! -f "$SERVER_DIR/package.json" ]]; then
    log_error "No se encontró package.json en $SERVER_DIR"
    exit 1
fi

# Confirmación
log_warn "╔════════════════════════════════════════════════════════╗"
log_warn "║           ADVERTENCIA: OPERACIÓN DESTRUCTIVA           ║"
log_warn "╚════════════════════════════════════════════════════════╝"
log_warn ""
log_warn "Este script eliminará TODAS las bases de datos de:"
log_warn "  • tfg_es (España)"
log_warn "  • tfg_fr (Francia)"
log_warn "  • tfg_de (Alemania)"
log_warn "  • tfg_pt (Portugal)"
log_warn "  • tfg_it (Italia)"
log_warn ""
log_warn "SE PERDERÁN TODOS LOS DATOS (votantes, sesiones, bloques, etc.)"
log_warn ""

read -p "¿Continuar? Escribe 'sí' para confirmar: " confirmation

if [[ "$confirmation" != "sí" ]]; then
    log_info "Operación cancelada"
    exit 0
fi

log_info ""
log_info "Limpiando bases de datos de todos los países..."

COUNTRIES=("es" "fr" "de" "pt" "it")

cd "$SERVER_DIR"

for country in "${COUNTRIES[@]}"; do
    log_info "Limpiando $country..."
    npm run "demo-clean:$country" > /dev/null 2>&1
    log_success "  Datos de $country eliminados ✓"
done

log_info ""
log_success "╔════════════════════════════════════════════════════════╗"
log_success "║       LIMPIEZA COMPLETADA                              ║"
log_success "╚════════════════════════════════════════════════════════╝"
log_info ""
log_info "Las bases de datos están vacías. Puedes ejecutar:"
log_info "  bash scripts/setup-all.sh"
log_info ""
log_info "para volver a hacer el setup completo."
