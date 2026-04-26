import dotenv from "dotenv";
import fs from "fs";
import { randomBytes, randomUUID } from "crypto";
import { canonicalJson } from "../../../shared/utils/canonical-json.util.js";
import { findVoterById, updateVoterToken } from "../repositories/voter.repository.js";
import { signEd25519, verifyEd25519 } from "../crypto/signatures/ed22519.js";
import { createTokenRequestPayload, createIssuedTokenPayload } from "./token-payload.service.js";
import { getCountryPrivateKeyPath } from "../config/paths.js";

dotenv.config();

export async function requestToken({
    voterId,
    voterPublicKey,
    requestedAt,
    identitySignature,
    authenticatedVoterId
}) {
    const countryCode = process.env.COUNTRY_CODE?.toLowerCase();
    const passphrase = process.env.COUNTRY_KEY_PASSPHRASE;

    if (!countryCode) {
        throw new Error("No se ha especificado el código del país");
    }

    if (!passphrase) {
        throw new Error("No se ha especificado la passphrase");
    }

    if (!voterId || !voterPublicKey || !requestedAt || !identitySignature) {
        return {
            ok: false,
            message: "No se ha proporcionado toda la información necesaria para generar el token"
        };
    }

    if (voterId !== authenticatedVoterId) {
        return {
            ok: false,
            message: "El votante de la solicitud no coincide con el votante autenticado"
        };
    }

    const voter = await findVoterById(voterId);

    if (!voter) {
        return {
            ok: false,
            message: "No se ha encontrado el votante"
        };
    }

    const requestPayload = createTokenRequestPayload({
        voterId,
        voterPublicKey,
        requestedAt
    });

    const canonicalRequestPayload = canonicalJson(requestPayload);
    const identitySignatureBuffer = Buffer.from(identitySignature, "base64");

    const isValidIdentitySignature = verifyEd25519(
        voter.identityPublicKey,
        canonicalRequestPayload,
        identitySignatureBuffer
    );

    if (!isValidIdentitySignature) {
        return {
            ok: false,
            message: "La firma de la identidad no es válida"
        };
    }

    const tokenId = randomUUID();
    const token = randomBytes(32).toString("hex");
    const issuedAt = new Date().toISOString();
    const used = false;

    const issuedTokenPayload = createIssuedTokenPayload({
        tokenId,
        token,
        voterPublicKey,
        issuedAt,
        used
    });

    const canonicalIssuedTokenPayload = canonicalJson(issuedTokenPayload);

    const countryPrivateKeyPath = getCountryPrivateKeyPath(countryCode);

    if (!fs.existsSync(countryPrivateKeyPath)) {
        throw new Error("No se ha encontrado la clave privada del país");
    }

    const countryPrivateKeyPem = fs.readFileSync(countryPrivateKeyPath, "utf-8");

    const anccSignature = signEd25519(
        {
            key: countryPrivateKeyPem,
            passphrase
        },
        canonicalIssuedTokenPayload
    ).toString("base64");

    const issuedToken = {
        tokenId,
        token,
        voterPublicKey,
        issuedAt,
        used,
        anccSignature
    };

    await updateVoterToken(voterId, issuedToken);

    return {
        ok: true,
        message: "Token generado exitosamente",
        token: issuedToken
    };
}