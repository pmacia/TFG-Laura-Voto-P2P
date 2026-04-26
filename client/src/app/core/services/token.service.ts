import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

import { API_CONFIG } from "../config/api.config";

import { VoteKeyService } from "./vote-key.service";
import { IdentityKeyService } from "./identity-key.service";
import { WebCryptoEd25519Service } from "./web-crypto-ed25519.service";

import { canonicalJson } from "../../../../../shared/utils/canonical-json.util";
import { VoteToken, VoteTokenRequestBody, VoteTokenRequestPayload, VoteTokenResponse } from "../../shared/models/token.models";
import { Voter } from "../../shared/models/auth.models";

@Injectable({
    providedIn: 'root'
})
export class TokenService {
    private readonly storageKey: string = "tfg_vote_token";
    private readonly apiUrl: string = `${API_CONFIG.BASE_URL}/token`;

    constructor(
        private http: HttpClient,
        private voteKeyService: VoteKeyService,
        private identityKeyService: IdentityKeyService,
        private cryptoService: WebCryptoEd25519Service
    ) { }

    getStoredToken(): VoteToken | null {
        const token = localStorage.getItem(this.storageKey);
        return token ? JSON.parse(token) : null;
    }

    saveToken(token: VoteToken): void {
        localStorage.setItem(this.storageKey, JSON.stringify(token));
    }

    clearToken(): void {
        localStorage.removeItem(this.storageKey);
    }

    async requestVoteToken(voter: Voter): Promise<VoteToken> {
        if (voter.token && voter.token.length > 0) {
            this.saveToken(voter.token[0]);
            return voter.token[0];
        }

        const voteKeyPair = await this.voteKeyService.ensureVoteKeyPair();
        const identityPrivateKey = this.identityKeyService.getIdentityPrivateKey();

        if (!identityPrivateKey) {
            throw new Error('No se ha encontrado la clave privada de identidad');
        }

        const payload: VoteTokenRequestPayload = {
            voterId: voter.voterId,
            voterPublicKey: voteKeyPair.publicKey,
            requestedAt: new Date().toISOString()
        };

        const canonicalJsonPayload = canonicalJson(payload);
        const identitySignature = await this.cryptoService.signToBase64(
            identityPrivateKey,
            canonicalJsonPayload
        );

        const tokenRequest: VoteTokenRequestBody = {
            ...payload,
            identitySignature
        };

        const response = await firstValueFrom(
            this.http.post<VoteTokenResponse>(
                this.apiUrl,
                tokenRequest
            )
        );

        if (!response.ok || !response.token) {
            throw new Error(response.message ?? 'No se ha recibido un token de voto');
        }

        this.saveToken(response.token);
        return response.token;
    }
}