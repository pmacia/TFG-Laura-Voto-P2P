$projectRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $projectRoot "server"

# -----------------------------------------
# Arrancamos los servidores de los paises
# -----------------------------------------

# España
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$serverPath'; `$Host.UI.RawUI.WindowTitle = 'País - España'; npm run dev:es"
)

# Francia
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$serverPath'; `$Host.UI.RawUI.WindowTitle = 'País - Francia'; npm run dev:fr"
)

# Alemania
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$serverPath'; `$Host.UI.RawUI.WindowTitle = 'País - Alemania'; npm run dev:de"
)

# Portugal
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$serverPath'; `$Host.UI.RawUI.WindowTitle = 'País - Portugal'; npm run dev:pt"
)

# Italia
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$serverPath'; `$Host.UI.RawUI.WindowTitle = 'País - Italia'; npm run dev:it"
)

# Esperamos un poco para dar tiempo a que arranquen
Start-Sleep -Seconds 5

# Abrimos las URLs en el navegador por defecto
Start-Process "http://localhost:3001"
Start-Process "http://localhost:3002"
Start-Process "http://localhost:3003"
Start-Process "http://localhost:3004"
Start-Process "http://localhost:3005"