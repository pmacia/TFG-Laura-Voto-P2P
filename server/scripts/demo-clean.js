import dotenv from "dotenv";
import { execSync } from "node:child_process";
import mongoose from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "../src/data/database.js";
import { VoterModel } from "../src/models/voter.model.js";

const country = process.argv[2];

if (!country) {
    console.error('Por favor, introduce el código del país');
    process.exit(1);
}

const result = dotenv.config({ path: `./env/.${country}.env` });

if (result.error) {
    console.error(`Error al cargar el archivo .${country}.env:`, result.error);
    process.exit(1);
}

function cleanChromiumProfiles() {
    console.log("Limpiando perfiles Chromium de demo...");

    try {
        if (process.platform === 'win32') {
            execSync(
                'powershell -Command "Remove-Item -Recurse -Force C:\\temp\\tfg-voter-* -ErrorAction SilentlyContinue"',
                { stdio: 'inherit' }
            );
        } else {
            // macOS / Linux: eliminar perfiles temporales en /tmp
            execSync('rm -rf /tmp/tfg-voter-*', { stdio: 'inherit' });
        }
        console.log('Perfiles Chromium eliminados.');
    } catch (err) {
        console.warn('No se pudo eliminar perfiles Chromium (posible SO no soportado o permisos). Continuando...', err && err.message ? err.message : err);
    }
}

async function cleanVoters() {
    await connectToDatabase(String(process.env.DATABASE_URI));

    try {
        console.log("Eliminando base de datos:", String(process.env.DATABASE_URI));
        await mongoose.connection.db.dropDatabase();
        console.log("Base de datos eliminada correctamente.");
    } catch (err) {
        console.error("Error al eliminar la base de datos:", err);
    }

    await disconnectFromDatabase();
    process.exit(0);
}

async function main() {
    cleanChromiumProfiles();
    await cleanVoters();

    console.log("Limpieza de demo completada.");
    process.exit(0);
}

main().catch((error) => {
    console.error("Error durante la limpieza de demo:");
    console.error(error);
    process.exit(1);
});