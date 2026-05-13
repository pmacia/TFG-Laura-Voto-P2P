import { Injectable } from "@angular/core";
import { API_CONFIG } from "../config/api.config";
import { VotingResultBlock } from "../../shared/models/p2p-message.models";
import { SessionService } from "./session.service";


@Injectable({
    providedIn: "root"
})
export class PublicBlockchainService {
    private readonly baseUrl = `${API_CONFIG.BASE_URL}/blockchain`;

    constructor(
        private sessionService: SessionService,
    ) { }

    async publishBlock(block: VotingResultBlock): Promise<void> {
        const sessionToken = this.sessionService.getSessionToken();

        if (!sessionToken) {
            throw new Error("No se ha encontrado token de sesión para publicar el bloque");
        }

        const response = await fetch(`${this.baseUrl}/blocks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ block })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.message ?? "No se pudo publicar el bloque");
        }
    }

    async getBlocks(): Promise<VotingResultBlock[]> {
        const response = await fetch(`${this.baseUrl}/blocks`);
        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.message ?? "No se pudieron consultar los bloques");
        }

        return data.blocks ?? [];
    }
}