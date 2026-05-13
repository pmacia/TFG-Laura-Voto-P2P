import { Injectable } from "@angular/core";
import { BehaviorSubject, take } from "rxjs";
import { SignalingService } from "./signaling.service";
import { WebRTCService } from "./webrtc.service";
import { LocalRoundState, RoundCreatedPayload } from "../../shared/models/p2p.models";
import { RoleSelectionService } from "./role-selection.service";

@Injectable({
    providedIn: "root"
})
export class P2PNetworkService {
    waitingState$ = new BehaviorSubject<any | null>(null);
    roundState$ = new BehaviorSubject<LocalRoundState | null>(null);
    connectionEvents$ = new BehaviorSubject<any[]>([]);
    p2pMessages$ = new BehaviorSubject<any[]>([]);
    error$ = new BehaviorSubject<string | null>(null);
    disconnectedPeers$ = new BehaviorSubject<string[]>([]);
    private roundPrepareSubject = new BehaviorSubject<any | null>(null);
    roundPrepare$ = this.roundPrepareSubject.asObservable();
    private preparedLastBlockHash: string | null = null;

    constructor(
        private signalingService: SignalingService,
        private webRTCService: WebRTCService,
        private roleSelectionService: RoleSelectionService
    ) {
        this.signalingService.messages$.subscribe(async (message) => {
            switch (message.type) {
                case "WAITING_ROOM_UPDATE":
                    this.waitingState$.next(message.payload);
                    break;

                case "ROUND_PREPARE":
                    this.roundPrepareSubject.next(message.payload);
                    break;

                case "ROUND_CREATED":
                    await this.handleRoundCreated(message.payload);
                    break;

                case "PEER_DISCONNECTED":
                    this.handlePeerDisconnected(message.payload);
                    break;

                case "ERROR":
                    this.error$.next(message.payload?.message ?? "Error P2P");
                    break;
            }
        });

        this.webRTCService.connectionState$.subscribe((event) => {
            this.connectionEvents$.next([
                ...this.connectionEvents$.value,
                event
            ]);
        });

        this.webRTCService.p2pMessage$.subscribe((event) => {
            this.p2pMessages$.next([
                ...this.p2pMessages$.value,
                event
            ]);
        });
    }

    connectAndJoin(params: { wsUrl: string; sessionToken: string; voterId: string; }): void {
        this.error$.next(null);

        this.signalingService.connect(params.wsUrl);

        this.signalingService.connected$
            .pipe(take(1))
            .subscribe(() => {
                this.signalingService.joinWaitingRoom(
                    params.sessionToken,
                    params.voterId
                );
            });
    }

    // TODO: eliminar
    broadcastTestMessage(): void {
        this.webRTCService.broadcast({
            type: "P2P_TEST",
            payload: {
                text: "Hola desde WebRTC!",
                sentAt: new Date().toISOString()
            }
        });
    }

    sendToPeer(peerId: string, data: any): void {
        this.webRTCService.sendToPeer(peerId, data);
    }

    broadcast(data: any): void {
        this.webRTCService.broadcast(data);
    }

    sendRoundReady(payload: {
        prepareId: string;
        lastBlockHash: string;
    }): void {
        this.preparedLastBlockHash = payload.lastBlockHash;

        this.signalingService.send({
            type: "ROUND_READY",
            payload
        });
    }

    sendRoundFinished(payload: {
        roundId: string;
        roundNumber: number;
        finalizedBlockHash: string;
    }): void {
        this.signalingService.send({
            type: "ROUND_FINISHED",
            payload
        });
    }

    // private async handleRoundCreated(
    //     round: RoundCreatedPayload
    // ): Promise<void> {
    //     try {

    //         const { lastBlockHash, roles } =
    //             await this.roleSelectionService.selectRolesFromBlockchain(
    //                 round.peers,
    //                 round.blockchain
    //             );

    //         const localRound: LocalRoundState = {
    //             ...round,
    //             lastBlockHash,
    //             roles
    //         };

    //         this.roundState$.next(localRound);

    //         await this.webRTCService.initializeRound(localRound);
    //     } catch (error: any) {
    //         this.error$.next(
    //             error?.message ?? "No se pudo procesar la ronda P2P"
    //         );
    //     }
    // }

    private async handleRoundCreated(
        round: RoundCreatedPayload
    ): Promise<void> {
        try {
            const lastBlockHash = this.preparedLastBlockHash ?? "GENESIS";

            const roles = await this.roleSelectionService.selectRolesFromLastBlockHash(
                round.peers,
                lastBlockHash
            );

            const localRound: LocalRoundState = {
                ...round,
                lastBlockHash,
                roles
            };

            this.roundState$.next(localRound);

            await this.webRTCService.initializeRound(localRound);
        } catch (error: any) {
            this.error$.next(
                error?.message ?? "No se pudo procesar la ronda P2P"
            );
        }
    }

    private handlePeerDisconnected(payload: any): void {
        const peerId = payload?.peerId;

        if (!peerId) {
            return;
        }

        this.webRTCService.removePeer(peerId);

        const currentDisconnected = this.disconnectedPeers$.value;

        if (!currentDisconnected.includes(peerId)) {
            this.disconnectedPeers$.next([...currentDisconnected, peerId]);
        }

        const currentRound = this.roundState$.value;

        if (!currentRound) {
            return;
        }

        const updatedRound = {
            ...currentRound,
            peers: currentRound.peers.filter((peer) => peer.peerId !== peerId),
            previousRoundPeers: currentRound.previousRoundPeers
        };

        this.roundState$.next(updatedRound);
    }
}