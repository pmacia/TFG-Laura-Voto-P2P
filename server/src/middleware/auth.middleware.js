import { validateSession } from "../services/session.service.js";

export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                ok: false,
                message: "No se ha proporcionado un token de sesión"
            });
        }

        const sessionToken = authHeader.split(" ")[1];

        if (!sessionToken) {
            return res.status(401).json({
                ok: false,
                message: "No se ha proporcionado un token de sesión"
            });
        }

        const session = await validateSession(sessionToken);

        if (!session || !session.ok) {
            return res.status(401).json({
                ok: false,
                message: "Token de sesión inválido o expirado"
            });
        }

        req.auth = {
            userId: session.session.userId,
            sessionToken: session.session.sessionToken
        };

        next();
    } catch (error) {
        return res.status(500).json({ ok: false, message: "Error interno del servidor" });
    }
}