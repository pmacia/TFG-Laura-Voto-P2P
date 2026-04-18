import { generateKeyPairSync, sign, verify } from "crypto";

export function generateEd22519KeyPair(options = {}) {
    const { passphrase, cipher = "aes-256-cbc" } = options;

    const privateKeyEncoding = {
        type: "pkcs8",
        format: "pem"
    };

    if (passphrase) {
        privateKeyEncoding.passphrase = passphrase;
        privateKeyEncoding.cipher = cipher;
    }

    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
        publicKeyEncoding: {
            type: "spki",
            format: "pem"
        },
        privateKeyEncoding
    });

    return { publicKey, privateKey };
}

export function signEd22519(privateKey, data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    return sign(null, buffer, privateKey);
}

export function verifyEd22519(publicKey, data, signature) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    return verify(null, buffer, publicKey, signature);
}