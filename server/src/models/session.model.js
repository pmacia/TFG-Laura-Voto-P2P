import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    sessionToken: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        required: true,
        default: false
    }
}, { timestamps: true });

export const SessionModel = mongoose.model("Session", sessionSchema);