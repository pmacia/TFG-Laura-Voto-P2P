#!/usr/bin/env bash
# setup-all.sh
# Script de setup completo: genera claves, carga configuración y crea votantes para todos los países
# Uso: bash scripts/setup-all.sh [--with-server]

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SERVER_DIR/.." && pwd)"
COUNTRIES=("es" "fr" "de" "pt" "it")
WITH_SERVER=false

# Funciones auxiliares
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar argumentos
if [[ "${1:-}" == "--with-server" ]]; then
    WITH_SERVER=true
    log_info "Se arrancará todos los servidores al final"
fi

# Verificar que estamos en el directorio correcto
if [[ ! -f "$SERVER_DIR/package.json" ]]; then
    log_error "No se encontró package.json en $SERVER_DIR"
    log_error "Asegúrate de ejecutar el script desde la carpeta server o usa: bash server/scripts/setup-all.sh"
    exit 1
fi

log_info "═══════════════════════════════════════════════════════════"
log_info "SETUP AUTOMÁTICO DEL SERVIDOR DE VOTACIÓN"
log_info "═══════════════════════════════════════════════════════════"

# Paso 1: Verificar MongoDB
log_info ""
log_info "Paso 1: Verificando MongoDB..."
if ! command -v mongosh &> /dev/null && ! command -v mongo &> /dev/null; then
    log_warn "MongoDB CLI no encontrado, asumiendo que está corriendo en localhost:27017"
else
    if ! mongosh --eval "db.adminCommand('ping')" &> /dev/null && ! mongo --eval "db.adminCommand('ping')" &> /dev/null; then
        log_error "No se puede conectar a MongoDB en localhost:27017"
        log_warn "Inicia MongoDB primero:"
        log_warn "  docker run -d --name mongo -p 27017:27017 -v mongodata:/data/db mongo:6.0"
        exit 1
    fi
    log_success "MongoDB está disponible"
fi

# Paso 2: Instalar dependencias
log_info ""
log_info "Paso 2: Instalando dependencias (npm install)..."
cd "$SERVER_DIR"
npm install > /dev/null 2>&1
log_success "Dependencias instaladas"

# Paso 3: Generar claves de firma (Ed25519) para todos los países
log_info ""
log_info "Paso 3: Generando claves de firma (Ed25519) para todos los países..."
for country in "${COUNTRIES[@]}"; do
    log_info "  Generando claves para $country..."
    npm run "keys:$country" > /dev/null 2>&1
    log_success "    Claves de firma para $country ✓"
done

# Paso 4: Generar claves de encriptación (RSA-OAEP) para todos los países
log_info ""
log_info "Paso 4: Generando claves de encriptación (RSA-OAEP) para todos los países..."
for country in "${COUNTRIES[@]}"; do
    log_info "  Generando claves RSA para $country..."
    npm run "keys-encryption:$country" > /dev/null 2>&1
    log_success "    Claves RSA para $country ✓"
done

# Paso 4.5: Publicar claves al cliente
log_info ""
log_info "Paso 4.5: Publicando claves públicas al cliente..."
if [[ -f "$SERVER_DIR/scripts/publish-keys-to-client.sh" ]]; then
    bash "$SERVER_DIR/scripts/publish-keys-to-client.sh"
    log_success "Claves públicas publicadas al cliente ✓"
else
    log_warn "No se encontró script publish-keys-to-client.sh — omitiendo publicación al cliente"
fi

# Paso 5: Cargar configuración de votación para todos los países
log_info ""
log_info "Paso 5: Cargando configuración de votación para todos los países..."
npm run seed-voting:all > /dev/null 2>&1
log_success "Configuración de votación cargada para todos los países ✓"

# Paso 6: Crear votantes de prueba (30 por país)
log_info ""
log_info "Paso 6: Creando 30 votantes de prueba por país..."
for country in "${COUNTRIES[@]}"; do
    log_info "  Creando votantes para $country..."
    npm run "seed-voters:$country" > /dev/null 2>&1
    log_success "    30 votantes creados para $country ✓"
done

# Paso 7: Resumen de credenciales de prueba
log_info ""
log_info "═══════════════════════════════════════════════════════════"
log_success "SETUP COMPLETADO EXITOSAMENTE"
log_info "═══════════════════════════════════════════════════════════"
log_info ""
log_info "CREDENCIALES DE PRUEBA:"
log_info "  Votante: es-1, fr-1, de-1, pt-1, it-1 (uno por país)"
log_info "  Contraseña: TFG_Pass_Segura6983985()·\$="
log_info ""
log_info "PUERTOS:"
log_info "  España (ES):   localhost:3001"
log_info "  Francia (FR):  localhost:3002"
log_info "  Alemania (DE): localhost:3003"
log_info "  Portugal (PT): localhost:3004"
log_info "  Italia (IT):   localhost:3005"
log_info ""
log_info "PRÓXIMOS PASOS:"
if [[ "$WITH_SERVER" == true ]]; then
    log_info "  Arrancando todos los servidores..."
    log_info ""
    cd "$PROJECT_ROOT"
    bash "$PROJECT_ROOT/scripts/start-all-countries.sh"
else
    log_info "  1. Arrancar servidores individuales:"
    log_info "     cd server && npm run dev:es"
    log_info ""
    log_info "  2. O arrancar todos a la vez (desde la raíz del proyecto):"
    log_info "     bash scripts/start-all-countries.sh"
    log_info ""
    log_info "  3. Probar endpoints (en otra terminal):"
    log_info "     curl -X POST http://localhost:3001/api/auth/login \\"
    log_info "     -H 'Content-Type: application/json' \\"
    log_info "     -d '{\"voterId\":\"es-1\",\"secretCode\":\"TFG_Pass_Segura6983985()·\\\$=\"}'"
fi
