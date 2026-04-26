import * as tokenService from "../../services/token.service.js";

export async function requestToken(req, res) {
    try {
        const result = await tokenService.requestToken({
            ...req.body,
            authenticatedVoterId: req.auth.userId
        });

        if (!result.ok) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            message: error.message
        });
    }
}