export type SignalingMessageType =
    | "JOIN_WAITING_ROOM"
    | "WAITING_ROOM_UPDATE"
    | "ROUND_CREATED"
    | "WEBRTC_OFFER"
    | "WEBRTC_ANSWER"
    | "WEBRTC_ICE_CANDIDATE"
    | "PEER_DISCONNECTED"
    | "ERROR"
    | "P2P_TEST";

export interface SignalingMessage<T = any> {
    type: SignalingMessageType;
    payload: T;
}

export interface P2PPeer {
    peerId: string;
    encryptionPublicKey: string;
    voteSigningPublicKey: string;
    joinedAt: string;
}

export interface BlockchainBlock {
    index: number;
    type: string;
    previousHash: string | null;
    timestamp: string;
    data: any;
    hash: string;
}

export interface RoundCreatedPayload {
    roundId: string;
    roundNumber: number;
    ownPeerId: string;
    peers: P2PPeer[];
    previousRoundPeers: P2PPeer[];
    blockchain: BlockchainBlock[];
    isFirstRound: boolean;
}

export interface RoundRoles {
    secretary: P2PPeer;
    notary: P2PPeer;
    president: P2PPeer;
}

export interface LocalRoundState extends RoundCreatedPayload {
    lastBlockHash: string;
    roles: RoundRoles;
}