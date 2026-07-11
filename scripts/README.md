# Scripts de Orquestación — TFG Multimedia

Conjunto de scripts bash/PowerShell para gestionar el ciclo de vida completo del sistema TFG Multimedia: arranque, parada, monitorización y limpieza de bases de datos.

## Requisitos previos

- **MongoDB**: Accesible en `localhost:27017` (local o Docker)
- **Node.js 18+** y **npm**
- **Bash 4+** (sistemas Unix/macOS/Linux)
- **sudo**: Necesario para algunos comandos (p. ej., iniciar MongoDB Docker)

## Scripts principales

### `start-everything.sh` — Arranque completo del sistema

**Propósito**: Inicia MongoDB (opcional), los 5 servidores de país, el cliente Angular y monitoriza el sistema.

**Uso**:
```bash
cd /ruta/a/TFG-multimedia
bash scripts/start-everything.sh [--start-mongo] [--logs]
```

**Opciones**:
- `--start-mongo` — Inicia MongoDB en Docker si no está corriendo (requiere `docker`)
- `--logs` — Abre ventanas de terminal separadas mostrando logs en vivo por componente (no disponible en todos los entornos)

**Flujo**:
1. Verifica que Node.js, npm y MongoDB están disponibles
2. Instala dependencias en `server/` y `client/` si es necesario
3. Opcionalmente inicia MongoDB en Docker
4. Arranca los 5 servidores (puertos 3001–3005) en paralelo
5. Arranca el cliente Angular (puerto 4200)
6. Imprime URLs y credenciales de prueba

**Ejemplo**:
```bash
bash scripts/start-everything.sh --start-mongo --logs
# Inicia MongoDB, servidores, cliente y abre logs en terminal
```

**Salida esperada** (sin `--logs`):
```
✅ Node.js checks passed
✅ npm checks passed
✅ MongoDB running at localhost:27017

🚀 Starting servers...
[ES] Node process PID 12345 listening on port 3001
[FR] Node process PID 12346 listening on port 3002
[DE] Node process PID 12347 listening on port 3003
[PT] Node process PID 12348 listening on port 3004
[IT] Node process PID 12349 listening on port 3005

🌐 Client starting on port 4200
http://localhost:4200

🔑 Demo credentials:
  Country: ES | Voter ID: es-1 | Code: TFG_Pass_Segura6983985()·$=
  ...

📊 System ready. Check status with: bash scripts/status.sh
```

---

### `stop-everything.sh` — Parada segura del sistema

**Propósito**: Detiene todos los servidores, cliente y opcionalmente MongoDB.

**Uso**:
```bash
bash scripts/stop-everything.sh [--stop-mongo]
```

**Opciones**:
- `--stop-mongo` — Detiene el contenedor MongoDB (requiere `docker`)

**Flujo**:
1. Detiene el cliente Angular (PM2 o proceso directo)
2. Detiene todos los servidores (SIGTERM → SIGKILL si es necesario)
3. Opcionalmente detiene MongoDB

**Ejemplo**:
```bash
bash scripts/stop-everything.sh --stop-mongo
# Detiene todo incluyendo MongoDB
```

---

### `status.sh` — Verificación de estado

**Propósito**: Muestra el estado actual de todos los componentes del sistema.

**Uso**:
```bash
bash scripts/status.sh
```

**Salida esperada**:
```
═══════════════════════════════════════════════════
         🔍 TFG Multimedia — System Status
═══════════════════════════════════════════════════

🗄️  MongoDB:
    ✅ Running at localhost:27017 (tfg_es, tfg_fr, tfg_de, tfg_pt, tfg_it)

🖥️  Servers:
    ✅ [ES] Port 3001 (PID 12345)
    ✅ [FR] Port 3002 (PID 12346)
    ✅ [DE] Port 3003 (PID 12347)
    ✅ [PT] Port 3004 (PID 12348)
    ✅ [IT] Port 3005 (PID 12349)

🌐 Client:
    ✅ Angular on port 4200 (PID 12350)
    📍 http://localhost:4200

═══════════════════════════════════════════════════
```

**Si algo está caído**:
```
    ❌ [FR] Port 3002 (Not running)
    📋 Restart with: kill $PID && npm run dev:fr
```

---

### `monitor.sh` — Monitorización en vivo

**Propósito**: Muestra actualización continua de estado, logs concatenados y estadísticas de sistema.

**Uso**:
```bash
bash scripts/monitor.sh [interval]
```

**Parámetros**:
- `interval` — Segundos entre actualizaciones (defecto: 2)

**Ejemplo**:
```bash
bash scripts/monitor.sh 3
# Actualiza estado cada 3 segundos
```

**Vista**:
- Lista de procesos con PIDs, puertos y uso de CPU/memoria
- Logs agregados de todos los servidores
- Contador de eventos (p. ej., autenticaciones, bloques publicados)

**Salir**: Presiona `Ctrl+C`

---

## Flujo de inicio recomendado

### 1. Primera vez (setup completo)

```bash
# (Desde la raíz del proyecto)

# Paso 1: Generar claves, votantes y configuración
cd server
bash scripts/setup-all.sh

# Paso 2: (Opcional) Ajustar fechas de votación si es necesario
# Edita server/edition-config/ESC_2026.json y recarga:
npm run seed-voting:all

# Paso 3: Publicar claves al cliente
bash scripts/publish-keys-to-client.sh

# Paso 4: Volver a raíz e iniciar todo
cd ..
bash scripts/start-everything.sh --start-mongo --logs
```

### 2. Uso rutinario (después de setup)

```bash
# Simplemente arrancar
bash scripts/start-everything.sh --logs

# Monitorizar en otra terminal
bash scripts/monitor.sh

# Simular votantes (en otra terminal más)
cd server
npm run demo-voters -- es 5  # 5 votantes de ES
```

### 3. Parada y reinicio

```bash
# Detener todo
bash scripts/stop-everything.sh

# Detener e iniciar nuevamente
bash scripts/stop-everything.sh --stop-mongo
sleep 2
bash scripts/start-everything.sh --start-mongo
```

---

## Limpieza y reset destructivo

Para limpiar BDs completamente (útil tras cambios estructurales):

```bash
cd server
bash scripts/clean-all.sh
# Elimina todas las 5 BDs (tfg_es, tfg_fr, tfg_de, tfg_pt, tfg_it)
```

IMPORTANTE: `bash scripts/clean-all.sh` ejecuta `server/scripts/demo-clean.js` para cada país. Ese script realiza una eliminación completa de la base de datos (equivalente a `dropDatabase` en MongoDB). Esta operación es destructiva e irreversible: realiza una copia de seguridad de tus datos si los necesitas antes de proceder.

Luego reinicia setup:
```bash
bash scripts/setup-all.sh
```

---

## Scripts específicos del servidor

En `server/scripts/` encontrarás scripts adicionales para tareas específicas:

- **`setup-all.sh`** — Configuración completa: genera claves, SU, votantes (30 por país)
- **`publish-keys-to-client.sh`** — Inyecta claves públicas en el cliente
- **`clean-all.sh`** — Elimina completamente las bases de datos de los países (destructivo). Ejecuta `server/scripts/demo-clean.js` que realiza `dropDatabase` en cada BD.
- **`seed-voting-config.js`** — Carga configuración JSON en BD de un país
- **`seed-voting-config-all.js`** — Carga configuración en todos los países
- **`seed-voters.js`** — Crea votantes de demo para un país
- **`start-country.js`** — Arranca un servidor individual
- **`demo-voters.js`** — Simula votantes votando (Playwright)

Para más detalles, ver [server/scripts/README.md](../server/scripts/README.md) (si existe) o inspecciona directamente los scripts.

---

## Troubleshooting

### MongoDB no está disponible

```bash
# Verificar si está corriendo
docker ps | grep mongo

# Iniciar explícitamente
docker run -d --name mongo -p 27017:27017 mongo:6.0

# O dejar que start-everything.sh lo haga
bash scripts/start-everything.sh --start-mongo
```

### Puertos ya en uso

Si obtienes errores de puerto ocupado:
```bash
# Detener procesos existentes
bash scripts/stop-everything.sh

# Esperar unos segundos
sleep 2

# Reintentar
bash scripts/start-everything.sh
```

### Client Angular no arranca

Asegúrate de que las dependencias están instaladas:
```bash
cd client
npm install
cd ..
bash scripts/start-everything.sh --logs
```

### Votantes no pueden conectar

Verifica que:
1. Los servidores están online: `bash scripts/status.sh`
2. Las claves están publicadas: comprueba `client/src/app/core/keys.ts` no está vacío
3. Las fechas de votación son futuras: edita `server/edition-config/ESC_2026.json`

---

## Variables de entorno

Todos los scripts leen sus configuraciones desde:
- `server/env/.es.env`, `.fr.env`, etc. — configuración por país
- Puertos definidos: 3001–3005 (servidores), 4200 (cliente)
- Base de datos: `tfg_<country>` en MongoDB local

Para cambiar puertos o URIs, edita los archivos `.env` correspondientes antes de arrancar.

---

## Resumen de comandos

| Comando | Propósito | Tiempo aprox. |
|---------|-----------|---------------|
| `bash scripts/start-everything.sh` | Arrancar todo el sistema | 5–10s |
| `bash scripts/start-everything.sh --start-mongo` | Arrancar con MongoDB desde 0 | 15–20s |
| `bash scripts/stop-everything.sh` | Parar todo (limpio) | 2–3s |
| `bash scripts/status.sh` | Ver estado actual | <1s |
| `bash scripts/monitor.sh` | Monitorizar en vivo (Ctrl+C para salir) | Continuo |
| `cd server && npm run demo-voters -- es 5` | Simular 5 votantes de ES | 30–60s |

---

## Plataformas soportadas

- **macOS**: Soportado completamente (bash, brew para herramientas)
- **Linux**: Soportado completamente (bash, apt/yum para herramientas)
- **Windows**: Parcialmente soportado (WSL2 recomendado; scripts PowerShell en desarrollo)

Para Windows, considera usar WSL2 con una distribución Linux:
```powershell
# En WSL
bash scripts/start-everything.sh --start-mongo
```

---

## Soporte y debugging

Si encuentras problemas:
1. Revisa logs: `bash scripts/monitor.sh`
2. Verifica estado: `bash scripts/status.sh`
3. Inspecciona BDs: `mongosh tfg_es` y consulta colecciones
4. Revisa el archivo de su proyecto (p. ej., `README.md`) para más contexto

Final Note: Estos scripts están diseñados para facilitar el desarrollo y testing local. Para producción, considera usar composición de servicios (Docker Compose, Kubernetes, etc.).
