import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase, disconnectFromDatabase } from "../src/data/database.js";
import { VoterModel } from "../src/models/voter.model.js";
import { hashSecretCode } from "../src/crypto/hashing/argon2id.js";
import { generateEd25519KeyPair } from "../src/crypto/signatures/ed22519.js";
import { getVoterKeysPath } from "../src/config/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, "..");
const supportedCountries = ["es", "fr", "de", "pt", "it"];
const countryArg = process.argv[2];
const countArg = Number(process.argv[3] || 30);
const voterCount = Number.isInteger(countArg) && countArg > 0 ? countArg : 30;

if (!countryArg) {
    console.error("Por favor, introduce el código del país o --all");
    process.exit(1);
}

function loadCountryEnv(country) {
    const envPath = path.join(SERVER_DIR, "env", `.${country}.env`);
    const result = dotenv.config({ path: envPath, override: true });

    if (result.error) {
        throw new Error(`Error al cargar el archivo ${envPath}: ${result.error.message}`);
    }
}

async function createVotersForCountry(country, count) {
    loadCountryEnv(country);

    await connectToDatabase(String(process.env.DATABASE_URI));

    const hashedSecretCode = await hashSecretCode("TFG_Pass_Segura6983985()·$=");
    const voterKeysPath = getVoterKeysPath(country);
    fs.mkdirSync(voterKeysPath, { recursive: true });

    for (let voterNumber = 1; voterNumber <= count; voterNumber++) {
        const voterId = `${country}-${voterNumber}`;
        const existingVoter = await VoterModel.findOne({ voterId });

        if (existingVoter) {
            console.log(`El votante ${voterId} ya existe. Se omite.`);
            continue;
        }

        const { publicKey, privateKey } = generateEd25519KeyPair();

        const voter = new VoterModel({
            voterId,
            secretCode: hashedSecretCode,
            identityPublicKey: publicKey,
            encryptionPublicKey: "",
            token: []
        });

        await voter.save();
        fs.writeFileSync(path.join(voterKeysPath, `${voterId}_private.pem`), privateKey);
        console.log(`Votante creado: ${voterId}`);
    }

    console.log(`Votantes creados exitosamente para ${country}`);
    await disconnectFromDatabase();
}

async function runAllCountries(count) {
    for (const country of supportedCountries) {
        console.log(`\n=== seed-voter para ${country} (${count} votantes) ===`);
        await createVotersForCountry(country, count);
    }
}

async function main() {
    if (countryArg === "--all") {
        await runAllCountries(voterCount);
        process.exit(0);
    }

    if (!supportedCountries.includes(countryArg)) {
        console.error(`País no soportado: ${countryArg}. Usa uno de: ${supportedCountries.join(", ")}`);
        process.exit(1);
    }

    try {
        await createVotersForCountry(countryArg, voterCount);
        process.exit(0);
    } catch (error) {
        console.error("Error al crear al votante:", error);
        process.exit(1);
    }
}

main();
