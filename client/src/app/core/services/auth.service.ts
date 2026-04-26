import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, tap } from "rxjs";

import { LoginRequest, LoginResponse } from "../../shared/models/auth.models";
import { API_CONFIG } from "../config/api.config";
import { SessionService } from "./session.service";
import { TokenService } from "./token.service";

@Injectable({
    providedIn: "root"
})
export class AuthService {
    private readonly apiUrl: string = `${API_CONFIG.BASE_URL}/auth`;

    constructor(
        private http: HttpClient,
        private sessionService: SessionService,
        private tokenService: TokenService
    ) { }

    login(payload: LoginRequest): Observable<LoginResponse> {
        return this.http
            .post<LoginResponse>(`${this.apiUrl}/login`, payload)
            .pipe(
                tap((response) => {
                    if (response.ok && response.session) {
                        this.sessionService.setSession(response.session);
                        localStorage.setItem("tfg_voter", JSON.stringify(response.voter));
                    }
                })
            );
    }

    isAuthenticated(): boolean {
        return !!this.sessionService.getSessionToken();
    }

    getStoredVoter(): LoginResponse['voter'] | null {
        const voter = localStorage.getItem("tfg_voter");
        return voter ? JSON.parse(voter) : null;
    }

    logout(): void {
        this.sessionService.clearSession();
        this.tokenService.clearToken();
        localStorage.removeItem("tfg_voter");
    }
}