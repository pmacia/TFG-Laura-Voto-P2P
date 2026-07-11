#!/usr/bin/env bash
# publish-keys-to-client.sh
# Copia las claves públicas generadas por país hacia `client/src/app/core/keys.ts`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KEYS_DIR="$REPO_ROOT/keys/countries"
CLIENT_KEYS_TS="$REPO_ROOT/client/src/app/core/keys.ts"

echo "[INFO] Publicando claves públicas al cliente..."

if [[ ! -d "$KEYS_DIR" ]]; then
  echo "[WARN] No se encontró $KEYS_DIR — nada que publicar"
  # Crear archivo vacío válido para evitar errores de import
  mkdir -p "$(dirname "$CLIENT_KEYS_TS")"
  cat > "$CLIENT_KEYS_TS" <<'TS'
// Auto-generado: COUNTRY_PUBLIC_KEYS
// Estructura vacía (ninguna clave disponible)
export const COUNTRY_PUBLIC_KEYS: Record<string, { ed25519SigningPublicKey: string; rsaEncryptionPublicKey: string }> = {};
export default COUNTRY_PUBLIC_KEYS;
TS
  echo "[OK] Archivo cliente creado en $CLIENT_KEYS_TS"
  exit 0
fi

mkdir -p "$(dirname "$CLIENT_KEYS_TS")"
tmpfile="$(mktemp)"

cat > "$tmpfile" <<'TS'
// Auto-generado por server/scripts/publish-keys-to-client.sh
// No editar a mano — este archivo puede ser sobrescrito por el script de setup
// Estructura: { ed25519SigningPublicKey: string; rsaEncryptionPublicKey: string }
export const COUNTRY_PUBLIC_KEYS: Record<string, { ed25519SigningPublicKey: string; rsaEncryptionPublicKey: string }> = {
TS

for d in "$KEYS_DIR"/*; do
  if [[ -d "$d" ]]; then
    code="$(basename "$d")"
    signing_file="$d/public.pem"
    enc_file="$d/encryption-public.pem"

    # Leer contenido y escapar backticks si existiesen (poco probable en PEM)
    signing_content=""
    encryption_content=""
    if [[ -f "$signing_file" ]]; then
      # Trim trailing newlines when inlining
      signing_content=$(sed 's/`/\\`/g' "$signing_file" | awk '{print}' ORS='\n')
    fi
    if [[ -f "$enc_file" ]]; then
      encryption_content=$(sed 's/`/\\`/g' "$enc_file" | awk '{print}' ORS='\n')
    fi

    printf "  '%s': {\n" "$code" >> "$tmpfile"

    # always emit string properties (empty string if not present)
    printf "    ed25519SigningPublicKey: \`\n" >> "$tmpfile"
    if [[ -n "$signing_content" ]]; then
      printf "%s" "$signing_content" >> "$tmpfile"
    fi
    printf "    \`,\n" >> "$tmpfile"

    printf "    rsaEncryptionPublicKey: \`\n" >> "$tmpfile"
    if [[ -n "$encryption_content" ]]; then
      printf "%s" "$encryption_content" >> "$tmpfile"
    fi
    printf "    \`,\n" >> "$tmpfile"

    printf "  },\n" >> "$tmpfile"
  fi
done

cat >> "$tmpfile" <<'TS'
};

export default COUNTRY_PUBLIC_KEYS;
TS

# Additionally emit a JSON copy of the public keys for runtime consumption and tests
JSON_OUT_SERVER="$REPO_ROOT/keys/public-keys.json"
JSON_OUT_CLIENT="$REPO_ROOT/client/src/assets/public-keys.json"
mkdir -p "$(dirname "$JSON_OUT_CLIENT")"

node - <<'NODE' "$KEYS_DIR" "$JSON_OUT_SERVER" "$JSON_OUT_CLIENT"
const fs = require('fs')
const path = require('path')
const keysDir = process.argv[2]
const outServer = process.argv[3]
const outClient = process.argv[4]
const countries = {}
if (fs.existsSync(keysDir)) {
  for (const name of fs.readdirSync(keysDir)) {
    const p = path.join(keysDir, name)
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) continue
    const signingFile = path.join(p, 'public.pem')
    const encFile = path.join(p, 'encryption-public.pem')
    const signing = fs.existsSync(signingFile) ? fs.readFileSync(signingFile, 'utf8') : ''
    const encryption = fs.existsSync(encFile) ? fs.readFileSync(encFile, 'utf8') : ''
    countries[name] = {
      ed25519SigningPublicKey: signing,
      rsaEncryptionPublicKey: encryption
    }
  }
}
fs.writeFileSync(outServer, JSON.stringify(countries, null, 2))
fs.writeFileSync(outClient, JSON.stringify(countries, null, 2))
NODE

mv "$tmpfile" "$CLIENT_KEYS_TS"
echo "[OK] Claves publicadas en $CLIENT_KEYS_TS"

echo "[OK] JSON publicado en $JSON_OUT_SERVER y $JSON_OUT_CLIENT"
