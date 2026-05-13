import mongoose from "mongoose";

const publicBlockSchema = new mongoose.Schema(
    {
        hash: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        index: {
            type: Number,
            required: true,
            index: true
        },

        roundId: {
            type: String,
            required: true,
            index: true
        },

        roundNumber: {
            type: Number,
            required: true,
            index: true
        },

        status: {
            type: String,
            required: true,
            enum: ["VALID", "ABORTED"]
        },

        block: {
            type: Object,
            required: true
        }
    },
    {
        timestamps: true
    }
);

export const PublicBlockModel = mongoose.models.PublicBlock || mongoose.model("PublicBlock", publicBlockSchema);