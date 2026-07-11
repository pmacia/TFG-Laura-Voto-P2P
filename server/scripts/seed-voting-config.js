import { spawnSync } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase, disconnectFromDatabase } from "../src/data/database.js";
import { createVotingConfig, deleteVotingConfig } from "../src/repositories/voting-config.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, "..");
const supportedCountries = ["es", "fr", "de", "pt", "it"];
const countryArg = process.argv[2];

if (!countryArg) {
    console.error("Error: Debes especificar el país o --all");
    process.exit(1);
}

function getEditionConfigPath() {
    return path.join(SERVER_DIR, "edition-config", `${process.env.EDITION_CODE}.json`);
}

function loadCountryEnv(country) {
    const envPath = path.join(SERVER_DIR, "env", `.${country}.env`);
    const result = dotenv.config({ path: envPath, override: true });

    if (result.error) {
        throw new Error(`Error al cargar el archivo ${envPath}: ${result.error.message}`);
    }
}

async function createVotingForCountry(country) {
    loadCountryEnv(country);

    await connectToDatabase(String(process.env.DATABASE_URI));

    const configPath = getEditionConfigPath();

    if (!fs.existsSync(configPath)) {
        throw new Error(`No existe el archivo de configuración: ${configPath}`);
    }

    const editionConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const candidatesWithoutOwnCountry = editionConfig.candidates.filter(
        (candidate) => candidate.countryCode !== process.env.COUNTRY_CODE
    );

    await deleteVotingConfig();

    await createVotingConfig(
        editionConfig.editionCode,
        editionConfig.title,
        editionConfig.votingStart,
        editionConfig.votingEnd,
        candidatesWithoutOwnCountry
    );

    console.log(`Votación creada exitosamente para el país: ${process.env.COUNTRY_CODE} - ${process.env.COUNTRY_NAME}`);
}

function runAllCountries() {
    for (const country of supportedCountries) {
        console.log(`\n=== seed-voting-config para ${country} ===`);

        const result = spawnSync(process.execPath, [
            "scripts/seed-voting-config.js",
            country
        ], {
            cwd: SERVER_DIR,
            stdio: "inherit"
        });

        if (result.error) {
            console.error(`Error ejecutando seed-voting-config.js para ${country}:`, result.error);
            process.exit(1);
        }

        if (result.status !== 0) {
            console.error(`seed-voting-config.js terminó con código ${result.status} para ${country}`);
            process.exit(result.status || 1);
        }
    }
}

async function main() {
    if (countryArg === "--all") {
        runAllCountries();
        process.exit(0);
    }

    if (!supportedCountries.includes(countryArg)) {
        console.error(`País no soportado: ${countryArg}. Usa uno de: ${supportedCountries.join(", ")}`);
        process.exit(1);
    }

    try {
        await createVotingForCountry(countryArg);
        process.exit(0);
    } catch (error) {
        console.error("Error al crear la votación:", error);
        process.exit(1);
    } finally {
        await disconnectFromDatabase();
    }
}

main();
