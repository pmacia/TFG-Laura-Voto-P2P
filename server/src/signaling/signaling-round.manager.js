import { randomUUID, createHash } from "crypto";
import { SIGNALING_TYPES, sendJson } from "./signaling-message-types.js";
import { canonicalJson } from "../../../shared/utils/canonical-json.util.js";
import { getVoterVotingPublicKeysById } from "../repositories/voter.repository.js";

const ROUND_SIZE = Number(process.env.P2P_ROUND_SIZE || 5);

let activeRound = null;
let activePrepare = null; // Ronda aún no confirmada a espera de confirmación de blockchain
let roundNumber = 0;

const waitingPeers = [];
const livePeersById = new Map();
const rounds = [];

let blockchain = [createGenesisBlock()];

function createGenesisBlock() {
    const blockBase = {
        index: 0,
        type: "GENESIS",
        previousHash: null,
        timestamp: new Date().toISOString(),
        data: {
            message: "Bloque génesis de la red P2P votación Eurovisión 2026"
        }
    };

    return {
        ...blockBase,
        hash: hashBlock(blockBase)
    }
}

function hashBlock(block) {
    const blockWithoutHash = { ...block };
    delete blockWithoutHash.hash;

    return createHash("sha256")
        .update(canonicalJson(blockWithoutHash))
        .digest("hex");
}

function createPrepare(peers) {
    return {
        prepareId: crypto.randomUUID(),
        peers,
        readyByPeerId: new Map(),
        createdAt: new Date().toISOString()
    };
}

// Solicitud a los clientes de que sincronicen la blockchain
function tryPrepareNextRound() {
    if (activeRound) {
        return;
    }

    if (activePrepare) {
        return;
    }

    if (waitingPeers.length < ROUND_SIZE) {
        //broadcastWaitingState();
        broadcastWaitingRoom();
        return;
    }

    const selectedPeers = waitingPeers.splice(0, ROUND_SIZE);

    activePrepare = {
        prepareId: randomUUID(),
        peers: selectedPeers,
        readyByPeerId: new Map(),
        createdAt: new Date().toISOString()
    };

    for (const peer of selectedPeers) {
        sendJson(peer.ws, {
            type: SIGNALING_TYPES.ROUND_PREPARE,
            payload: {
                prepareId: activePrepare.prepareId,
                requiredCount: ROUND_SIZE,
                peerIds: selectedPeers.map((item) => item.peerId)
            }
        });
    }

    //broadcastWaitingState();
    broadcastWaitingRoom();
}

// Crear la ronda solo si todos coinciden
function maybeCreatePreparedRound() {
    if (!activePrepare) { return; }

    const expectedCount = activePrepare.peers.length;

    if (activePrepare.readyByPeerId.size < expectedCount) { return; }

    const readyItems = Array.from(activePrepare.readyByPeerId.values());
    const uniqueLastBlockHashes = new Set(
        readyItems.map((item) => item.lastBlockHash)
    );

    if (uniqueLastBlockHashes.size !== 1) {
        for (const peer of activePrepare.peers) {
            sendJson(peer.ws, {
                type: SIGNALING_TYPES.ERROR,
                payload: {
                    message: "Los nodos no coinciden en el último bloque verificado. Se reintentará la ronda."
                }
            });

            waitingPeers.push(peer);
        }

        activePrepare = null;
        //broadcastWaitingState();
        broadcastWaitingRoom();
        setTimeout(() => tryPrepareNextRound(), 500);
        return;
    }

    const lastBlockHash = readyItems[0].lastBlockHash;
    const selectedPeers = activePrepare.peers;

    activePrepare = null;

    createRoundFromPreparedPeers(selectedPeers, lastBlockHash);
}

async function createRoundFromPreparedPeers(peers, lastBlockHash) {
    roundNumber += 1;

    const roundId = randomUUID();

    activeRound = {
        roundId,
        roundNumber,
        peers,
        lastBlockHash,
        createdAt: new Date().toISOString()
    };

    const publicPeers = peers.map(toPublicPeer);

    for (const peer of peers) {
        peer.roundId = roundId;

        sendJson(peer.ws, {
            type: SIGNALING_TYPES.ROUND_CREATED,
            payload: {
                roundId,
                roundNumber,
                ownPeerId: peer.peerId,
                peers: publicPeers,
                lastBlockHash
            }
        });
    }
}

export function handleRoundFinished(ws, payload) {
    if (!activeRound) {
        return;
    }

    const peer = findLivePeerBySocket(ws);

    if (!peer) {
        return;
    }

    if (payload.roundId !== activeRound.roundId) {
        return;
    }

    const belongsToActiveRound = activeRound.peers.some(
        (item) => item.peerId === peer.peerId
    );

    if (!belongsToActiveRound) {
        return;
    }

    activeRound = null;

    for (const finishedPeer of livePeersById.values()) {
        if (finishedPeer.roundId === payload.roundId) {
            finishedPeer.roundId = null;
        }
    }

    //broadcastWaitingState();
    broadcastWaitingRoom();

    setTimeout(() => tryPrepareNextRound(), 500);
}

export async function registerPeer({ ws, voterId }) {
    if (livePeersById.has(voterId)) {
        sendJson(ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "Este votante ya está conectado a signaling"
            }
        });
        return;
    }

    const voterKeys = await getVoterVotingPublicKeysById(voterId);

    const peer = {
        peerId: randomUUID(),
        voterId,
        encryptionPublicKey: voterKeys.encryptionPublicKey,
        voterSigningPublicKey: voterKeys.voterSigningPublicKey,
        joinedAt: new Date().toISOString(),
        ws,
        roundId: null
    };

    livePeersById.set(peer.peerId, peer);
    waitingPeers.push(peer);

    broadcastWaitingRoom();

    if (waitingPeers.length >= ROUND_SIZE) {
        tryPrepareNextRound();
    }
}

export function handleRoundReady(ws, payload) {
    if (!activePrepare) {
        sendJson(ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "No hay preparación de ronda activa"
            }
        });
        return;
    }

    const peer = findLivePeerBySocket(ws);

    if (!peer) {
        sendJson(ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "Peer no encontrado"
            }
        });
        return;
    }

    const belongsToPrepare = activePrepare.peers.some(
        (item) => item.peerId === peer.peerId
    );

    if (!belongsToPrepare) {
        sendJson(ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "El peer no pertenece a la preparación actual"
            }
        });
        return;
    }

    if (payload.prepareId !== activePrepare.prepareId) {
        sendJson(ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "prepareId incorrecto"
            }
        });
        return;
    }

    if (!payload.lastBlockHash) {
        sendJson(ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "Falta lastBlockHash"
            }
        });
        return;
    }

    activePrepare.readyByPeerId.set(peer.peerId, {
        peerId: peer.peerId,
        lastBlockHash: payload.lastBlockHash,
        readyAt: new Date().toISOString()
    });

    maybeCreatePreparedRound();
}

export function unregisterPeerBySocket(ws) {
    let removedPeer = null;

    for (const [peerId, peer] of livePeersById.entries()) {
        if (peer.ws === ws) {
            removedPeer = peer;
            livePeersById.delete(peerId);
            break;
        }
    }

    if (!removedPeer) {
        return;
    }

    const waitingIndex = waitingPeers.findIndex(
        (peer) => peer.peerId === removedPeer.peerId
    );

    if (waitingIndex >= 0) {
        waitingPeers.splice(waitingIndex, 1);
        broadcastWaitingRoom();
    }

    if (removedPeer.roundId) {
        broadcastToRoundExcept(removedPeer.roundId, {
            type: SIGNALING_TYPES.PEER_DISCONNECTED,
            payload: {
                peerId: removedPeer.peerId
            }
        });
    }
}

function broadcastWaitingRoom() {
    const payload = {
        waitingCount: waitingPeers.length,
        requiredCount: ROUND_SIZE,
        peers: waitingPeers.map(toPublicPeer)
    };

    for (const peer of waitingPeers) {
        sendJson(peer.ws, {
            type: SIGNALING_TYPES.WAITING_ROOM_UPDATE,
            payload
        });
    }
}

function createRound() {
    const selectedPeers = waitingPeers.splice(0, ROUND_SIZE);
    const previousRound = rounds.at(-1) || null;

    const roundId = randomUUID();
    const roundNumber = rounds.length + 1;
    const publicPeers = selectedPeers.map(toPublicPeer);

    const round = {
        roundId,
        roundNumber,
        createdAt: new Date().toISOString(),
        peers: publicPeers,
        previousRoundPeers: previousRound ? previousRound.peers : [],
        blockchain
    };

    rounds.push(round);

    for (const peer of selectedPeers) {
        peer.roundId = roundId;

        sendJson(peer.ws, {
            type: SIGNALING_TYPES.ROUND_CREATED,
            payload: {
                roundId,
                roundNumber,
                ownPeerId: peer.peerId,
                peers: publicPeers,
                previousRoundPeers: round.previousRoundPeers,
                blockchain: round.blockchain,
                isFirstRound: roundNumber === 1
            }
        });
    }

    broadcastWaitingRoom();
}

export function relayToPeer({ fromPeerId, toPeerId, type, payload }) {
    const targetPeer = livePeersById.get(toPeerId);
    const sourcePeer = livePeersById.get(fromPeerId);

    if (!sourcePeer) {
        return;
    }

    if (!targetPeer) {
        sendJson(sourcePeer.ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: `Peer destino no encontrado: ${toPeerId}`
            }
        });
        return;
    }

    if (!sourcePeer.roundId || !targetPeer.roundId || sourcePeer.roundId !== targetPeer.roundId) {
        sendJson(sourcePeer.ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "No puedes enviar mensajes a peers de otra ronda"
            }
        });
        return;
    }

    sendJson(targetPeer.ws, {
        type,
        payload: {
            ...payload,
            fromPeerId,
            toPeerId
        }
    });
}

export function findLivePeerBySocket(ws) {
    for (const peer of livePeersById.values()) {
        if (peer.ws === ws) {
            return peer;
        }
    }

    return null;
}

function broadcastToRound(roundId, message) {
    for (const peer of livePeersById.values()) {
        if (peer.roundId === roundId) {
            sendJson(peer.ws, message);
        }
    }
}

function broadcastToRoundExcept(roundId, excludedPeerId, message) {
    for (const peer of livePeersById.values()) {
        if (peer.roundId === roundId && peer.peerId !== excludedPeerId) {
            sendJson(peer.ws, message);
        }
    }
}

function toPublicPeer(peer) {
    return {
        peerId: peer.peerId,
        encryptionPublicKey: peer.encryptionPublicKey,
        voterSigningPublicKey: peer.voterSigningPublicKey,
        joinedAt: peer.joinedAt
    };
}