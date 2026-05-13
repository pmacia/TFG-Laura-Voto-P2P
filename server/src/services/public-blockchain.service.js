import { PublicBlockModel } from "../models/public-block.model.js";

export async function getBlocks() {
    const blocks = await PublicBlockModel.find()
        .sort({
            index: 1,
            roundNumber: 1,
            createdAt: 1
        })
        .lean();

    return blocks.map((item) => item.block);
}

export async function publishBlock(block) {
    const validationError = validatePublicBlock(block);

    if (validationError) {
        return {
            ok: false,
            statusCode: 400,
            message: validationError
        };
    }

    const existing = await PublicBlockModel.findOne({
        hash: block.hash
    }).lean();

    if (existing) {
        return {
            ok: true,
            statusCode: 200,
            message: "El bloque ya estaba publicado"
        };
    }

    await PublicBlockModel.create({
        hash: block.hash,
        index: block.payload.index,
        roundId: block.payload.roundId,
        roundNumber: block.payload.roundNumber,
        status: block.payload.status,
        block
    });

    return {
        ok: true,
        statusCode: 200,
        message: "Bloque publicado"
    };
}

function validatePublicBlock(block) {
    if (!block || typeof block !== "object") {
        return "Bloque malformado";
    }

    if (!block.hash || !block.payload) {
        return "Bloque malformado";
    }

    if (!Array.isArray(block.approvals) || block.approvals.length === 0) {
        return "Solo se aceptan bloques finalizados con aprobaciones";
    }

    if (typeof block.payload.index !== "number") {
        return "El índice del bloque no es válido";
    }

    if (!block.payload.roundId) {
        return "El bloque no contiene roundId";
    }

    if (typeof block.payload.roundNumber !== "number") {
        return "El número de ronda no es válido";
    }

    if (!block.payload.status) {
        return "El bloque no contiene estado";
    }

    return null;
}