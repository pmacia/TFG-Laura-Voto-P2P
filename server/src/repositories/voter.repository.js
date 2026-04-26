import { VoterModel } from "../models/voter.model.js";

export async function findVoterById(voterId) {
    return await VoterModel.findOne({ voterId });
}

export async function updateVoterToken(voterId, token) {
    return await VoterModel.findOneAndUpdate(
        { voterId },
        {
            $set: { token: [token] }
        },
        {
            returnDocument: "after"
        }
    );
}