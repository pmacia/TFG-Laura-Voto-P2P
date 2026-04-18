import mongoose from "mongoose";
import { tokenSchema } from "./token.model.js";

const voterSchema = new mongoose.Schema({
    voterId: {
        type: String,
        required: true,
        unique: true
    },
    secretCode: {
        type: String,
        required: true
    },
    identityPublicKey: {
        type: String,
        required: true
    },
    token: {
        type: [tokenSchema],
        required: true
    }
}, { timestamps: { createdAt: "registeredAt", updatedAt: "updatedAt" } });

export const VoterModel = mongoose.model("Voter", voterSchema);