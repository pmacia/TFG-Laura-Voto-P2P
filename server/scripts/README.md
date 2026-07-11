# Scripts de gestión del servidor

Todos los scripts están en `server/scripts/`. Son utilidades para gestionar claves, seed de datos, limpieza de BD y arranque.

---

## 🚀 `setup-all.sh` - Setup automático completo (RECOMENDADO)

**Función**: automatiza todo el proceso de puesta en marcha: genera claves, carga configuración y crea votantes para todos los 5 países en una sola ejecución.

**Ubicación**: `server/scripts/setup-all.sh`

**Uso**:
```bash
cd server
bash scripts/setup-all.sh
```

Los scripts están en `server/scripts/` y facilitan:
- generación de claves (Ed25519 + RSA-OAEP)
- seeding de configuración y votantes
- limpieza destructiva de BDs
- arranque de servidores por país

Recomendación rápida
- Para una puesta en marcha completa y reproducible use:
  ```bash
  cd server
  bash scripts/setup-all.sh
  ```

`setup-all.sh` genera claves públicas/privadas, carga `edition-config/ESC_2026.json` y crea votantes de demo para los países configurados.

Lista de scripts importantes (resumen)
- `setup-all.sh` — Setup automático: instala dependencias, genera claves (firma y cifrado), seed de votación y votantes.
- `publish-keys-to-client.sh` — Publica las claves públicas en `client/src/app/core/keys.ts` (útil en desarrollo).
- `clean-all.sh` — Limpieza destructiva de bases de datos (pide confirmación).
- `start-country.js` — Arranca una instancia del servidor cargando `server/env/.<country>.env`.
- `seed-voting-config.js` / `seed-voting-config-all.js` — Carga la configuración de votación.
- `seed-voters.js` — Genera votantes de prueba y sus claves privadas en `keys/voters/`.
- `demo-voters.js` / `demo-voter.js` — Scripts de simulación con Playwright para automatizar la votación.
- `demo-clean.js` — Limpia una BD de país específica.

## Simulación de votación (resumen)

Los scripts `demo-voters.js` y `demo-voter.js` son la entrada de la simulación automatizada. Abrirán navegadores Chromium controlados por Playwright, completarán login, seleccionarán países, confirmarán votos y participarán en el protocolo P2P.

Para el proceso completo de simulación —incluyendo edición de `ESC_2026.json`, instalación de Playwright, creación de votantes simulados, publicación de claves y arranque de servicios— consulta la guía en:

- `client/README.md`
- `../../README.md`

Uso típico
1. Generar claves y seed (automático): `cd server && bash scripts/setup-all.sh`
2. Si desea exponer las claves al cliente de desarrollo: `bash server/scripts/publish-keys-to-client.sh`
3. Arrancar un país: `cd server && npm run dev:es` o `node scripts/start-country.js es`

Notas
- `publish-keys-to-client.sh` escribe un fichero TypeScript en el cliente con las claves públicas inline — es una conveniencia para desarrollo, no para producción.
- Los scripts usan los `.env` en `server/env/` para obtener `DATABASE_URI`, `COUNTRY_CODE`, passphrases, etc.
- `clean-all.sh` es destructivo: confirme antes de ejecutar.

Más detalles y ejemplos de uso (comandos y outputs esperados) se encuentran directamente en los scripts dentro de `server/scripts/`.
