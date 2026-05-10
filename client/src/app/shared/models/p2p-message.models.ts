import { VotePlain } from "./vote.model";
import { VoteToken } from "./token.models";
import { EncryptedEnvelope } from "./encrypted.model";

export type P2PMessageType =
    | "VOTE_TO_SECRETARY"
    | "SECRETARY_BATCH_TO_NOTARY"
    | "NOTARY_BATCH_TO_PRESIDENT"
    | "PROPOSED_BLOCK";

export interface P2PMessage<TPayload = unknown> {
    type: P2PMessageType;
    payload: TPayload;
}

export interface SignedP2PPayload<TPayload = unknown> {
    signerPeerId: string;
    payload: TPayload;
    signatureBase64: string;
}

export interface TokenRoundProofPayload {
    roundId: string;
    roundNumber: number;
    token: VoteToken;
}

export interface TokenRoundProof {
    payload: TokenRoundProofPayload;
    signatureBase64: string;
}

// Capa destinada al presidente
export interface PresidentInnerPayload {
    roundId: string;
    roundNumber: number;
    votePlain: VotePlain;
    tokenRoundProof: TokenRoundProof;
}

// Capa destinada al notario
export interface NotaryInnerPayload {
    roundId: string;
    roundNumber: number;
    votePlainHash: string;
    encryptedForPresident: EncryptedEnvelope;
}

// Capa destinada al secretario
export interface SecretaryInnerPayload {
    roundId: string;
    roundNumber: number;
    encryptedForNotary: EncryptedEnvelope;
}

// Payload enviado por un votante al secretario
export interface VoteToSecretaryPayload {
    roundId: string;
    roundNumber: number;
    fromPeerId: string;
    toSecretaryPeerId: string;
    encryptedForSecretary: EncryptedEnvelope;
}

// Mensaje completo enviado por un votante al secretario
export type VoteToSecretaryMessage = P2PMessage<SignedP2PPayload<VoteToSecretaryPayload>>;

// Payload enviado por el secretario al notario
export interface SecretaryBatchToNotaryPayload {
    roundId: string;
    roundNumber: number;
    secretaryPeerId: string;
    notaryPeerId: string;
    encryptedForNotaryBatch: EncryptedEnvelope[];
}

// Mensaje completo enviado por el secretario al notario
export type SecretaryBatchToNotaryMessage = P2PMessage<SignedP2PPayload<SecretaryBatchToNotaryPayload>>;

// Payload compromiso hashes del notario
export interface NotaryHashCommitmentPayload {
    roundId: string;
    roundNumber: number;
    notaryPeerId: string;
    votePlainHashes: string[];
}

// Hashes firmados por el notario
export type NotaryHashCommitment = SignedP2PPayload<NotaryHashCommitmentPayload>;

// Payload enviado por el notario al presidente
export interface NotaryBatchToPresidentPayload {
    roundId: string;
    roundNumber: number;
    notaryPeerId: string;
    presidentPeerId: string;
    notaryHashCommitment: NotaryHashCommitment;
    encryptedForPresidentBatch: EncryptedEnvelope[];
}

// Mensaje completo enviado por el notario al presidente
export type NotaryBatchToPresidentMessage = P2PMessage<SignedP2PPayload<NotaryBatchToPresidentPayload>>;

/**
 * Estado del bloque de resultado.
 *
 * VALID:
 *   Todos los tokens son válidos y se publican resultados.
 *
 * ABORTED:
 *   Algún token no es válido o se detecta una inconsistencia.
 *   En ese caso no se publican votos en claro.
 */
export type VotingResultBlockStatus = "VALID" | "ABORTED";

// Motivos de anulación de una ronda
export type VotingRoundAbortReason =
    | "INVALID_TOKEN"
    | "DUPLICATED_TOKEN"
    | "TOKEN_ALREADY_USED"
    | "INVALID_TOKEN_ROUND_SIGNATURE"
    | "HASH_COMMITMENT_MISMATCH"
    | "INVALID_NOTARY_SIGNATURE"
    | "INVALID_PRESIDENT_SIGNATURE"
    | "MALFORMED_BATCH"
    | "UNKNOWN_ERROR";

// Referencia a un token inválido, para bloques ABORTED
export interface InvalidTokenEvidence {
    tokenRoundProof?: TokenRoundProof;
    token?: VoteToken;
    reason: VotingRoundAbortReason;
    details?: string;
}

// Roles de la ronda incluidos en el bloque
export interface VotingRoundRolesSnapshot {
    secretaryPeerId: string;
    secretaryVotePublicKey: string;
    notaryPeerId: string;
    notaryVotePublicKey: string;
    presidentPeerId: string;
    presidentVotePublicKey: string;
}

// Payload bloque de resultado
export interface VotingResultBlockPayload {
    index: number;
    previousHash: string;

    roundId: string;
    roundNumber: number;

    status: VotingResultBlockStatus;
    reason?: VotingRoundAbortReason;

    roles: VotingRoundRolesSnapshot;

    notaryHashCommitment?: NotaryHashCommitment;
    votes?: VotePlain[];
    tokenRoundProofs?: TokenRoundProof[];
    tally?: Record<string, number>;
    invalidTokens?: InvalidTokenEvidence[];

    createdAt: string;
}

// Bloque resultado firmado por el presidente
export interface VotingResultBlock {
    payload: VotingResultBlockPayload;
    hash: string;
    presidentPeerId: string;
    presidentSignatureBase64: string;
}

// Bloque propuesto
export interface ProposedBlockPayload {
    block: VotingResultBlock;
}

export type ProposedBlockMessage = P2PMessage<ProposedBlockPayload>;

// Tipos de mensajes válidos del protocolo
export type AnyVotingP2PMessage =
    | VoteToSecretaryMessage
    | SecretaryBatchToNotaryMessage
    | NotaryBatchToPresidentMessage
    | ProposedBlockMessage;