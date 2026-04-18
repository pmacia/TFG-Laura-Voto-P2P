import { authenticateVoter } from "../../services/auth.service.js";

export async function loginController(req, res) {
    try {
        const { voterId, secretCode } = req.body;
        const result = await authenticateVoter(voterId, secretCode);

        if (!result.ok) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ ok: false, message: "Error interno del servidor", error: error.message });
    }
}