import { Injectable } from "@angular/core";
import { BlockchainBlock, P2PPeer, RoundRoles } from "../../shared/models/p2p.models";
import { BlockchainVerificationService } from "./blockchain-verification.service";
import { sha256Hex } from "../utils/sha256Hex.util";

@Injectable({
    providedIn: "root"
})
export class RoleSelectionService {
    constructor(
        private blockchainVerificationService: BlockchainVerificationService
    ) { }

    // async selectRolesFromBlockchain(
    //     peers: P2PPeer[],
    //     blockchain: BlockchainBlock[]
    // ): Promise<{
    //     lastBlockHash: string;
    //     roles: RoundRoles;
    // }> {
    //     if (!Array.isArray(peers) || peers.length < 3) {
    //         throw new Error("Se necesitan al menos tres peers para seleccionar roles");
    //     }

    //     const lastBlockHash = await this.blockchainVerificationService.getLastBlockHash(blockchain);

    //     const orderedPeers = await this.deterministicOrderPeers(peers, lastBlockHash);

    //     return {
    //         lastBlockHash,
    //         roles: {
    //             secretary: orderedPeers[0],
    //             notary: orderedPeers[1],
    //             president: orderedPeers[2]
    //         }
    //     };
    // }

    async selectRolesFromLastBlockHash(
        peers: P2PPeer[],
        lastBlockHash: string
    ): Promise<RoundRoles> {
        if (!Array.isArray(peers) || peers.length < 3) {
            throw new Error("Se necesitan al menos tres peers para seleccionar roles");
        }

        const seed = lastBlockHash || "GENESIS";

        const orderedPeers = await this.deterministicOrderPeers(
            peers,
            seed
        );

        return {
            secretary: orderedPeers[0],
            notary: orderedPeers[1],
            president: orderedPeers[2]
        };
    }

    private async deterministicOrderPeers(
        peers: P2PPeer[],
        seed: string
    ): Promise<P2PPeer[]> {
        const scoredPeers = await Promise.all(
            peers.map(async (peer) => ({
                peer,
                score: await sha256Hex(`${seed}:${peer.peerId}`)
            }))
        );

        return scoredPeers
            .sort((a, b) => a.score.localeCompare(b.score))
            .map((entry) => entry.peer);
    }
}