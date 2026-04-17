import { countryServer } from "./app/countryServer.js";

countryServer().catch((error) => {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
});