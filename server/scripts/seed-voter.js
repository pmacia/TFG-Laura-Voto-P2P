import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { connectToDatabase, disconnectFromDatabase } from "../src/data/database.js";
import { VoterModel } from "../src/models/voter.model.js";
import { hashSecretCode } from "../src/crypto/hashing/argon2id.js";
import { generateEd25519KeyPair } from "../src/crypto/signatures/ed22519.js";
import { getVoterKeysPath } from "../src/config/paths.js";

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

async function createVoter() {
    await connectToDatabase(String(process.env.DATABASE_URI));
    const hashedSecretCode = await hashSecretCode("TFG_Pass_Segura6983985()·$=");
    // const { publicKey, privateKey } = generateEd25519KeyPair();

    // const voter = new VoterModel({
    //     voterId: `${country}-1`,
    //     secretCode: hashedSecretCode,
    //     identityPublicKey: publicKey,
    //     encryptionPublicKey: "",
    //     token: []
    // });
    // await voter.save();

    // console.log("Votante creado exitosamente");
    // await disconnectFromDatabase();

    // const voterKeysPath = getVoterKeysPath(country);
    // fs.mkdirSync(voterKeysPath, { recursive: true });
    // fs.writeFileSync(path.join(voterKeysPath, `${voter.voterId}_private.pem`), privateKey);

    const voterKeysPath = getVoterKeysPath(country);
    fs.mkdirSync(voterKeysPath, { recursive: true });

    for (let voterNumber = 1; voterNumber <= 30; voterNumber++) {
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

        fs.writeFileSync(
            path.join(voterKeysPath, `${voterId}_private.pem`),
            privateKey
        );

        console.log(`Votante creado: ${voterId}`);
    }

    console.log("Votantes creados exitosamente");
    await disconnectFromDatabase();
}

createVoter().catch((error) => {
    console.error('Error al crear al votante:', error);
    process.exit(1);
});