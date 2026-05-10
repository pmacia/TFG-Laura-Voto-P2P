import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import { VotingConfig } from '../../../shared/models/voting-config.models';
import { VotePlain, VoteEncrypted } from '../../../shared/models/vote.model';

import { VotingConfigService } from '../../services/voting-config.service';
import { VoteService } from '../../services/vote.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Candidate } from '../../../shared/models/voting-config.models';
import "flag-icons/css/flag-icons.min.css";
import { LocalRoundState } from '../../../shared/models/p2p.models';
import { P2PNetworkService } from '../../services/p2p-network.service';
import { SessionService } from '../../services/session.service';
import { Subscription } from 'rxjs';
import { API_CONFIG } from '../../config/api.config';
import { VotingState, VoteStep, SelectedPerformanceVideo } from '../../../shared/models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  voting: VotingConfig | null = null;
  votingState: VotingState | null = null;
  voteStep: VoteStep = 'selection';
  selectedPerformance: SelectedPerformanceVideo | null = null;

  selectedCountries: string[] = [];
  votePlain: VotePlain | null = null;
  encryptedVote: VoteEncrypted | null = null;
  symmetricKey: string | null = null;

  countdownText = "";
  private intervalId: number | null = null;

  loading = false;
  errorMessage = "";
  successMessage = "";

  loadingVoting = false;
  preparingVote = false;
  joiningP2P = false;

  waitingState: any | null = null;
  roundState: LocalRoundState | null = null;
  connectionEvents: any[] = [];
  p2pMessages: any[] = [];
  p2pError: string | null = null;
  disconnectedPeers: string[] = [];

  private subscriptions: Subscription[] = [];

  graphNodes: Array<{
    peerId: string;
    x: number;
    y: number;
    role: 'secretary' | 'notary' | 'president' | 'voter';
    roleLabel: string;
    isSelf: boolean;
  }> = [];

  graphEdges: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }> = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private votingConfigService: VotingConfigService,
    private voteService: VoteService,
    private sanitizer: DomSanitizer,
    private sessionService: SessionService,
    private p2pNetworkService: P2PNetworkService
  ) { }

  async ngOnInit() {
    this.subscribeToP2PState();
    await this.loadVotingConfig();
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
    }

    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  private async loadVotingConfig() {
    try {
      this.loading = true;
      this.errorMessage = "";
      this.successMessage = "";

      this.voting = await this.votingConfigService.getVotingConfig();
      this.updateVotingState();

      this.intervalId = window.setInterval(() => {
        this.updateVotingState();
      }, 1000);
    } catch (error) {
      this.errorMessage = "Error al cargar la votación";
    } finally {
      this.loading = false;
    }
  }

  private async updateVotingState() {
    if (!this.voting) {
      this.votingState = null;
      return;
    }

    const now = Date.now();
    const start = new Date(this.voting.votingStart).getTime();
    const end = new Date(this.voting.votingEnd).getTime();

    if (now < start) {
      this.votingState = 'not-started';
      this.countdownText = this.formatCountdown(start - now);
      return;
    } else if (now > end) {
      this.votingState = 'closed';
      this.countdownText = "La votación ha finalizado";
      return;
    } else {
      this.votingState = 'open';
      this.countdownText = "La votación está abierta";
    }
  }

  private formatCountdown(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days} días ${hours} horas ${minutes} minutos ${seconds} segundos`;
    if (hours > 0) return `${hours} horas ${minutes} minutos ${seconds} segundos`;
    return `${minutes} minutos ${seconds} segundos`;
  }

  onCountrySelectionChange(countryCode: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      if (!this.selectedCountries.includes(countryCode)) {
        this.selectedCountries = [...this.selectedCountries, countryCode]
      }
    } else {
      this.selectedCountries = this.selectedCountries.filter(
        (code) => code !== countryCode
      )
    }
  }

  async confirmVote(): Promise<void> {
    try {
      this.errorMessage = "";
      this.successMessage = "";

      if (this.votingState !== "open") {
        throw new Error("La votación no está abierta");
      }

      this.votePlain = this.voteService.prepareVotePlain(this.selectedCountries);
      [this.encryptedVote, this.symmetricKey] = await this.voteService.encryptVote(this.votePlain);

      this.voteStep = 'p2p';
      this.successMessage = "Voto preparado correctamente. Conectando a la red P2P...";

      this.joinP2PAfterVotePrepared();
    } catch (error: any) {
      this.errorMessage = error?.message ?? "No se pudo preparar el voto";
    } finally {
      this.preparingVote = false;
    }
  }

  sendTestP2PMessage(): void {
    this.p2pNetworkService.broadcastTestMessage();
  }

  private joinP2PAfterVotePrepared(): void {
    const sessionToken = this.sessionService.getSessionToken();

    console.log(sessionToken);

    if (!sessionToken) {
      throw new Error("No hay sesión activa");
    }

    const voterRaw = localStorage.getItem("tfg_voter");

    if (!voterRaw) {
      throw new Error("No hay votante autenticado");
    }

    const voter = JSON.parse(voterRaw);

    if (!voter.voterId) {
      throw new Error("No se pudo obtener el voterId");
    }

    this.joiningP2P = true;

    const wsUrl = this.getSignalingUrl();

    this.p2pNetworkService.connectAndJoin({
      wsUrl,
      sessionToken,
      voterId: voter.voterId
    });
  }

  private subscribeToP2PState(): void {
    this.p2pNetworkService.waitingState$.subscribe((state) => {
      this.waitingState = state;
    });

    this.p2pNetworkService.disconnectedPeers$.subscribe((peers) => {
      this.disconnectedPeers = peers;
    });

    this.p2pNetworkService.roundState$.subscribe((state) => {
      this.roundState = state;

      if (state) {
        this.joiningP2P = false;
        this.voteStep = 'p2p';
        this.successMessage = 'Ronda P2P creada correctamente';
        this.buildP2PGraph();
      }
    });

    this.p2pNetworkService.connectionEvents$.subscribe((events) => {
      this.connectionEvents = events;

      const disconnectedStates = new Set([
        'disconnected',
        'failed',
        'closed',
        'peer-disconnected',
        'datachannel-closed'
      ]);

      const disconnected = events
        .filter((event) => disconnectedStates.has(event.state))
        .map((event) => event.peerId)
        .filter((peerId) => !!peerId);

      this.disconnectedPeers = Array.from(new Set(disconnected));

      if (this.roundState) {
        this.buildP2PGraph();
      }
    });

    this.p2pNetworkService.p2pMessages$.subscribe((messages) => {
      this.p2pMessages = messages;
    });

    this.p2pNetworkService.error$.subscribe((error) => {
      this.p2pError = error;

      if (error) {
        this.joiningP2P = false;
      }
    });
  }

  prepareVote(): void {
    if (this.selectedCountries.length === 0) { return; }

    this.voteStep = 'review';
  }

  backToSelection(): void {
    this.voteStep = 'selection';
  }

  get selectedCandidates() {
    if (!this.voting?.candidates) {
      return [];
    }

    return this.voting.candidates.filter(candidate =>
      this.selectedCountries.includes(candidate.countryCode)
    );
  }

  trackByCountry(_index: number, candidate: { countryCode: string }): string {
    return candidate.countryCode;
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openPerformanceVideo(candidate: Candidate): void {
    if (!candidate.performanceUrl) {
      this.errorMessage = `No hay vídeo disponible para ${candidate.countryName}`;
      return;
    }

    const embedUrl = this.toYoutubeEmbedUrl(candidate.performanceUrl);

    if (!embedUrl) {
      this.errorMessage = `El vídeo de ${candidate.countryName} no tiene una URL válida`;
      return;
    }

    this.selectedPerformance = {
      countryCode: candidate.countryCode,
      countryName: candidate.countryName,
      safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl)
    };
  }

  closePerformanceVideo(): void {
    this.selectedPerformance = null;
  }

  private toYoutubeEmbedUrl(url: string): string | null {
    const videoId = this.extractYoutubeVideoId(url);

    if (!videoId) {
      return null;
    }

    return `https://www.youtube.com/embed/${videoId}`;
  }

  private extractYoutubeVideoId(url: string): string | null {
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
    );

    return match ? match[1] : null;
  }

  private getSignalingUrl(): string {
    return API_CONFIG.WS_URL;
  }

  private buildP2PGraph(): void {
    if (!this.roundState) {
      this.graphNodes = [];
      this.graphEdges = [];
      return;
    }

    const peers = this.roundState.peers.filter(
      (peer) => !this.disconnectedPeers.includes(peer.peerId)
    );

    if (peers.length === 0) {
      this.graphNodes = [];
      this.graphEdges = [];
      return;
    }

    const ownPeerId = this.roundState.ownPeerId;
    const secretaryPeerId = this.roundState.roles.secretary.peerId;
    const notaryPeerId = this.roundState.roles.notary.peerId;
    const presidentPeerId = this.roundState.roles.president.peerId
    const total = peers.length;

    const centerX = 300;
    const centerY = 210;
    const radius = 145;

    this.graphNodes = peers.map((peer: any, index: number) => {
      const angle = (2 * Math.PI * index) / total - Math.PI / 2;

      const isSelf = peer.peerId === ownPeerId;
      const isSecretary = peer.peerId === secretaryPeerId;
      const isNotary = peer.peerId === notaryPeerId;
      const isPresident = peer.peerId === presidentPeerId;

      let role: 'secretary' | 'notary' | 'president' | 'voter' = 'voter';
      let roleLabel = 'Votante';


      if (isSecretary) {
        role = 'secretary';
        roleLabel = 'Secretario';
      }

      if (isNotary) {
        role = 'notary';
        roleLabel = 'Notario';
      }

      if (isPresident) {
        role = 'president';
        roleLabel = 'Presidente';
      }

      if (isSelf) {
        roleLabel = `Yo\n${roleLabel}`;
      }

      return {
        peerId: peer.peerId,
        countryCode: peer.countryCode,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        role,
        roleLabel,
        isSelf
      };
    });

    const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    for (let i = 0; i < this.graphNodes.length; i++) {
      for (let j = i + 1; j < this.graphNodes.length; j++) {
        edges.push({
          x1: this.graphNodes[i].x,
          y1: this.graphNodes[i].y,
          x2: this.graphNodes[j].x,
          y2: this.graphNodes[j].y
        });
      }
    }

    this.graphEdges = edges;
  }
}
