import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
    tokenId: {
        type: String,
        required: true,
        unique: true
    },
    token: {
        type: String,
        required: true
    },
    voterPublicKey: {
        type: String,
        required: true
    },
    anccSignature: {
        type: String,
        required: true
    },
    used: {
        type: Boolean,
        default: false
    }
}, { timestamps: { createdAt: "issuedAt", updatedAt: "updatedAt" } });

export const TokenModel = mongoose.model("Token", tokenSchema);
export { tokenSchema };