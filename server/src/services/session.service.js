import { randomBytes } from "crypto";
import { createSession as createSessionRepo, findSessionByToken, deactivateSession } from "../repositories/session.repository.js";

const SESSION_TTL_MINUTES = 60;

export async function createSession(userId) {
    const sessionToken = randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

    return await createSessionRepo(sessionToken, userId, expiresAt);
}

export async function validateSession(sessionToken) {
    const session = await findSessionByToken(sessionToken);
    if (!session) {
        return {
            ok: false,
            message: "Sesión no encontrada"
        };
    }
    if (session.expiresAt < new Date()) {
        await deactivateSession(sessionToken);
        return {
            ok: false,
            message: "Sesión expirada"
        };
    }
    return {
        ok: true,
        session
    };
}

export async function invalidateSession(sessionToken) {
    return await deactivateSession(sessionToken);
}