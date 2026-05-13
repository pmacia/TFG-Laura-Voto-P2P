import { WebSocketServer } from "ws";
import { SIGNALING_TYPES, sendJson } from "./signaling-message-types.js";
import { registerPeer, unregisterPeerBySocket, relayToPeer, handleRoundReady, handleRoundFinished } from "./signaling-round.manager.js";
import { validateSession } from "../services/session.service.js";

export function attachSignalingWebSocketServer(httpServer) {
    const wss = new WebSocketServer({
        server: httpServer,
        path: "/signaling"
    });

    wss.on("connection", (ws) => {
        console.log("Client conectado a /signaling");

        ws.on("message", (rawMessage) => {
            try {
                const message = JSON.parse(rawMessage.toString());
                handleMessage(ws, message);
            } catch (error) {
                console.error("Mensaje signaling inválido:", error);

                sendJson(ws, {
                    type: SIGNALING_TYPES.ERROR,
                    payload: {
                        message: "Mensaje signaling inválido"
                    }
                });
            }
        });

        ws.on("close", () => {
            unregisterPeerBySocket(ws);
            console.log("Cliente desconectado de /signaling");
        });
    });

    console.log("Signaling WebSocket preparado en /signaling");
}

function handleMessage(ws, message) {
    const { type, payload } = message;

    switch (type) {
        case SIGNALING_TYPES.JOIN_WAITING_ROOM:
            handleJoinWaitingRoom(ws, payload);
            break;
        case SIGNALING_TYPES.WEBRTC_OFFER:
        case SIGNALING_TYPES.WEBRTC_ANSWER:
        case SIGNALING_TYPES.WEBRTC_ICE_CANDIDATE:
            handleRelayMessage(type, payload);
            break;
        case SIGNALING_TYPES.ROUND_READY:
            handleRoundReady(ws, payload);
            break;
        case SIGNALING_TYPES.ROUND_FINISHED:
            handleRoundFinished(ws, payload);
            break;
        default:
            sendJson(ws, {
                type: SIGNALING_TYPES.ERROR,
                payload: {
                    message: `Tipo de mensaje no soportado: ${type}`
                }
            });
    }
}

async function handleJoinWaitingRoom(ws, payload) {
    const { sessionToken, voterId } = payload || {}

    if (!sessionToken || !voterId) {
        sendJson(ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "Falta el id del votatante, voterId"
            }
        });
        return;
    }

    const session = await validateSession(sessionToken);

    if (!session || session.session.userId !== voterId) {
        sendJson(ws, {
            type: SIGNALING_TYPES.ERROR,
            payload: {
                message: "Sesión inválida para unirse a la red P2P"
            }
        });
        return;
    }

    registerPeer({ ws, voterId });
}

function handleRelayMessage(type, payload) {
    const { fromPeerId, toPeerId } = payload || {};

    if (!fromPeerId || !toPeerId) {
        return;
    }

    relayToPeer({ fromPeerId, toPeerId, type, payload });
}