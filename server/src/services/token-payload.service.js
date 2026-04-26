export function createTokenRequestPayload({ voterId, voterPublicKey, requestedAt }) {
    return {
        voterId,
        voterPublicKey,
        requestedAt
    };
}

export function createIssuedTokenPayload({
    tokenId,
    token,
    voterPublicKey,
    issuedAt,
    used
}) {
    return {
        tokenId,
        token,
        voterPublicKey,
        issuedAt,
        used
    };
}