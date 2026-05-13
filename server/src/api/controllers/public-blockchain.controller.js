import * as publicBlockchainService from "../../services/public-blockchain.service.js";


export async function getBlocks(_req, res) {
    try {
        const blocks = await publicBlockchainService.getBlocks();

        return res.json({
            ok: true,
            blocks
        });
    } catch (error) {
        console.error("Error obteniendo bloques:", error);

        return res.status(500).json({
            ok: false,
            message: "No se pudieron obtener los bloques"
        });
    }
}

export async function postBlock(req, res) {
    try {
        const { block } = req.body;

        const result = await publicBlockchainService.publishBlock(block);

        return res.status(result.statusCode).json({
            ok: result.ok,
            message: result.message
        });
    } catch (error) {
        console.error("Error publicando bloque:", error);

        return res.status(500).json({
            ok: false,
            message: "No se pudo publicar el bloque"
        });
    }
}