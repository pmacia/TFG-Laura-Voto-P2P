import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import { VotingConfig } from '../../../shared/models/voting-config.models';
import { VotePlain } from '../../../shared/models/vote.model';

import { VotingConfigService } from '../../services/voting-config.service';
import { VoteService } from '../../services/vote.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type VotingState = 'not-started' | 'open' | 'closed';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  voting: VotingConfig | null = null;
  votingState: VotingState | null = null;

  selectedCountries: string[] = [];
  votePlain: VotePlain | null = null;

  countdownText = "";
  private intervalId: number | null = null;

  loading = false;
  errorMessage = "";
  successMessage = "";

  constructor(
    private authService: AuthService,
    private router: Router,
    private votingConfigService: VotingConfigService,
    private voteService: VoteService
  ) { }

  async ngOnInit() {
    await this.loadVotingConfig();
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
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

  prepareVotePlain(): void {
    try {
      this.errorMessage = "";
      this.successMessage = "";

      if (this.votingState !== "open") {
        throw new Error("La votación no está abierta");
      }

      this.votePlain = this.voteService.prepareVotePlain(this.selectedCountries);
      this.successMessage = "Voto preparado correctamente";
    } catch (error: any) {
      this.errorMessage = error?.message ?? "No se pudo preparar el voto";
    }
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
