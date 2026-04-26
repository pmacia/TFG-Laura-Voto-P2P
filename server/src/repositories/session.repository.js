import { SessionModel } from "../models/session.model.js";

export async function createSession(sessionToken, userId, expiresAt) {
    const session = new SessionModel({
        sessionToken,
        userId,
        expiresAt,
        isActive: true
    });
    return await session.save();
}

export async function findSessionByToken(sessionToken) {
    return await SessionModel.findOne({
        sessionToken,
        isActive: true
    });
}

export async function deactivateSession(sessionToken) {
    return await SessionModel.findOneAndUpdate(
        {
            sessionToken,
            isActive: true
        },
        { isActive: false },
        { returnDocument: "after" }
    );
}