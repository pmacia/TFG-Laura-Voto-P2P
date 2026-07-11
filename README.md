# TFG Multimedia — Sistema de votación P2P (Resumen)

Proyecto: sistema de votación electrónica basado en un prototipo distribuido (caso práctico: Eurovisión). Contiene un backend formado por cinco instancias (una por país) y un frontend Angular que actúa como cliente P2P.

Propósito de este README: instrucciones rápidas y comandos unificados para preparar y ejecutar el entorno local de pruebas.

**Requisitos mínimos**
- Node.js 18+ (recomendado)
- npm
- MongoDB accesible en `localhost:27017` (Docker es la opción recomendada)
- macOS o Linux (Windows: usar WSL2)

---

## Guía de inicio rápido: Desde cero hasta una votación simulada

### Paso 1: Preparar el entorno (una sola vez)

1. **Arrancar MongoDB** en un contenedor Docker:
```bash
docker run -d --name mongo -p 27017:27017 -v mongodata:/data/db mongo:6.0
```

2. **Generar claves, cargar configuración y crear votantes de demo**:
```bash
cd server
bash scripts/setup-all.sh
```
Este comando:
- Genera claves Ed25519 (firma) y RSA-OAEP (encriptación) para cada país
- Carga la configuración de votación desde `edition-config/ESC_2026.json`
- Crea 30 votantes de prueba por país (ej: `es-1`, `es-2`... `es-30`)
- Publica las claves públicas en el cliente

### Paso 2: Preparar una votación (antes de arrancar)

Por defecto, `ESC_2026.json` usa fechas del pasado:
- `votingStart`: `2026-04-26T18:00:00Z`
- `votingEnd`: `2026-05-21T23:00:00Z`

Para que los votantes vean una **votación abierta**:

```bash
# Editar server/edition-config/ESC_2026.json
# Cambiar las fechas a:
# "votingStart": "2026-05-23T10:00:00Z",
# "votingEnd": "2026-05-24T23:00:00Z"

# O usa sed para hacerlo automáticamente:
sed -i '' 's/"votingStart": "2026-04-26T18:00:00Z"/"votingStart": "2026-05-23T10:00:00Z"/g' server/edition-config/ESC_2026.json
sed -i '' 's/"votingEnd": "2026-05-21T23:00:00Z"/"votingEnd": "2026-05-24T23:00:00Z"/g' server/edition-config/ESC_2026.json

# Recargar la configuración en las bases de datos:
cd server
npm run seed-voting:all
```

### Paso 3: Arrancar todo el sistema

```bash
cd /ruta/del/proyecto
bash scripts/start-everything.sh --start-mongo --logs
```

Esto abre:
- **5 terminales** con los servidores de países (puertos 3001-3005)
- **1 terminal** del cliente Angular (puerto 4200)
- **Logs centralizados** mostrando toda la actividad

**Acceso**:
- Cliente web: http://localhost:4200

### Paso 4: Simular votantes (en otra terminal)

```bash
cd server
# Lanzar 5 votantes simultáneos (cada uno vota por 1-3 países al azar)
npm run demo-voters -- es 5
```

Esto abre 5 navegadores Chromium con votantes `es-1` a `es-5` que:
- Inician sesión automáticamente
- Seleccionan países al azar
- Preparan y confirman el voto
- Se unen a la red P2P

**Nota**: Si necesitas que vuelvan a hacer login desde cero:
```bash
rm -rf server/C:/temp/tfg-voter-*
npm run demo-voters -- es 5
```

---

## Flujo de una votación paso a paso

1. **Login del votante** (http://localhost:4200):
   - ID de votante: `es-1` (o `fr-1`, `de-1`, `pt-1`, `it-1`)
   - Código secreto: `TFG_Pass_Segura6983985()·$=`
   - Clave privada: selecciona el archivo `.pem` desde `keys/voters/<country>/<voterId>_private.pem`

2. **Selección de países**: elige países a apoyar (no puedes votar por el tuyo)

3. **Preparación del voto**: revisa la selección y confirma

4. **Protocolo P2P**: el sistema ejecuta un protocolo de votación distribuido:
   - Cada votante se comunica con otros en la red
   - Se cifran y se intercambian votos
   - Se calculan resultados sin revelar votos individuales

5. **Resultados**: visualiza los puntos finales en el dashboard

---

## Comandos utiles

**Setup y limpieza**:
```bash
cd server
bash scripts/setup-all.sh              # Setup completo (claves, config, votantes)
bash scripts/clean-all.sh              # Borrar todas las BDs (cuidado!)
bash scripts/publish-keys-to-client.sh # Republish llaves públicas al cliente
```

**Arranque**:
```bash
# Desde la raíz del proyecto:
bash scripts/start-everything.sh --start-mongo --logs  # Orquestador (recomendado)
bash scripts/start-all-countries.sh                    # Arrancar 5 servidores
cd client && npm start                                 # Arrancar cliente solo
```

**Simulación de votantes**:
```bash
cd server
npm run demo-voters -- es 5    # 5 votantes de España
npm run demo-voters -- fr 3    # 3 votantes de Francia
```

**Monitorización**:
```bash
bash scripts/status.sh              # Estado de procesos
bash scripts/monitor.sh --follow    # Logs centralizados
bash scripts/stop-everything.sh     # Parar todo
```

---

Quick start (resumen ejecutivo)
1) `docker run -d --name mongo -p 27017:27017 -v mongodata:/data/db mongo:6.0`
2) `cd server && bash scripts/setup-all.sh`
3) `bash scripts/start-everything.sh --start-mongo --logs` (desde raíz)
4) Abre http://localhost:4200
5) (Opcional) `npm run demo-voters -- es 5` (desde server) para simular votantes

---

## Documentación adicional

Para profundizar en áreas concretas del proyecto, consulta los README específicos:

- [server/README.md](server/README.md): documentación del backend, generación de claves, configuración de votación y endpoints.
- [client/README.md](client/README.md): guía del cliente Angular, integración con claves públicas y simulación de votaciones desde la interfaz.
- [scripts/README.md](scripts/README.md): descripción de los scripts de orquestación de raíz para iniciar, detener, monitorizar y preparar el sistema.
- [server/scripts/README.md](server/scripts/README.md): explicación de los scripts del servidor para seed de datos, creación de votantes, limpieza y simulación con Playwright.

Estos archivos contienen instrucciones más detalladas y ejemplos específicos para cada sub-sistema.

