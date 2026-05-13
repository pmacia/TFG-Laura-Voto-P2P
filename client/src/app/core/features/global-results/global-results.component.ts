import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { PublicBlockchainService } from "../../services/public-blockchain.service";
import { P2PCryptoService } from "../../services/p2p-crypto.service";

import {
  ANCC_MIRRORS,
  AnccMirrorConfig
} from "../../config/ancc-mirrors.config";

import {
  VotingResultBlock
} from "../../../shared/models/p2p-message.models";

import { VotePlain } from "../../../shared/models/vote.model";
import { canonicalJson } from "../../utils/canonical-json.util";

interface CountryBlockchainResult {
  countryCode: string;
  countryName: string;
  baseUrl: string;

  loading: boolean;
  ok: boolean;
  error?: string;

  rawBlocks: VotingResultBlock[];
  verifiedBlocks: VotingResultBlock[];

  accumulatedTally: Record<string, number>;
  awardedPoints: Record<string, number>;
}

@Component({
  selector: "app-global-results",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./global-results.component.html",
  styleUrl: "./global-results.component.scss"
})
export class GlobalResultsComponent implements OnInit {
  loading = false;
  errorMessage = "";
  successMessage = "";

  countryResults: CountryBlockchainResult[] = [];
  globalPoints: Record<string, number> = {};

  readonly mirrors = ANCC_MIRRORS;
  private readonly countryNames: Record<string, string> = {
    ES: "España",
    FR: "Francia",
    DE: "Alemania",
    PT: "Portugal",
    IT: "Italia"
  };

  constructor(
    private publicBlockchainService: PublicBlockchainService,
    private p2pCryptoService: P2PCryptoService,
    private router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadGlobalResults();
  }

  async loadGlobalResults(): Promise<void> {
    this.loading = true;
    this.errorMessage = "";
    this.successMessage = "";
    this.globalPoints = {};

    const results: CountryBlockchainResult[] = [];

    for (const mirror of this.mirrors) {
      const result = await this.loadCountryResult(mirror);
      results.push(result);
    }

    this.countryResults = results;
    this.globalPoints = this.calculateGlobalPoints(results);

    const verifiedCount = results.filter((item) => item.ok).length;

    this.successMessage =
      `Clasificación global calculada con ${verifiedCount}/${results.length} blockchain(s) verificadas.`;

    this.loading = false;
  }

  getCountryName(countryCode: string): string {
    return this.countryNames[countryCode?.toUpperCase()] ?? countryCode;
  }

  private async loadCountryResult(
    mirror: AnccMirrorConfig
  ): Promise<CountryBlockchainResult> {
    const baseResult: CountryBlockchainResult = {
      countryCode: mirror.countryCode,
      countryName: mirror.countryName,
      baseUrl: mirror.baseUrl,

      loading: false,
      ok: false,

      rawBlocks: [],
      verifiedBlocks: [],

      accumulatedTally: {},
      awardedPoints: {}
    };

    try {
      const rawBlocks =
        await this.publicBlockchainService.getBlocksFromBaseUrl(mirror.baseUrl);

      const verifiedBlocks = await this.verifyBlockchain(rawBlocks);

      const accumulatedTally =
        this.calculateAccumulatedVoteCountsFromBlockchain(verifiedBlocks);

      const awardedPoints =
        this.calculateEurovisionPoints(accumulatedTally);

      return {
        ...baseResult,
        ok: true,
        rawBlocks,
        verifiedBlocks,
        accumulatedTally,
        awardedPoints
      };
    } catch (error: any) {
      return {
        ...baseResult,
        ok: false,
        error: error?.message ?? "No se pudo verificar la blockchain nacional"
      };
    }
  }

  private calculateGlobalPoints(
    countryResults: CountryBlockchainResult[]
  ): Record<string, number> {
    const global: Record<string, number> = {};

    for (const result of countryResults) {
      if (!result.ok) {
        continue;
      }

      for (const [countryCode, points] of Object.entries(result.awardedPoints)) {
        global[countryCode] = (global[countryCode] ?? 0) + points;
      }
    }

    return global;
  }

  get globalPointsList(): Array<{ country: string; points: number }> {
    return Object.entries(this.globalPoints)
      .map(([country, points]) => ({ country, points }))
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        return a.country.localeCompare(b.country);
      });
  }

  get verifiedCountryResults(): CountryBlockchainResult[] {
    return this.countryResults.filter((item) => item.ok);
  }

  get failedCountryResults(): CountryBlockchainResult[] {
    return this.countryResults.filter((item) => !item.ok);
  }

  getCountryAwardedPointsList(
    result: CountryBlockchainResult
  ): Array<{ country: string; points: number }> {
    return Object.entries(result.awardedPoints)
      .map(([country, points]) => ({ country, points }))
      .sort((a, b) => b.points - a.points);
  }

  getCountryTallyList(
    result: CountryBlockchainResult
  ): Array<{ country: string; count: number }> {
    return Object.entries(result.accumulatedTally)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }

  openCountryResults(result: CountryBlockchainResult): void {
    this.router.navigate(["/results"], {
      queryParams: {
        country: result.countryCode,
        baseUrl: result.baseUrl
      }
    });
  }

  private calculateAccumulatedVoteCountsFromBlockchain(
    blocks: VotingResultBlock[]
  ): Record<string, number> {
    const accumulated: Record<string, number> = {};

    for (const block of blocks) {
      if (block.payload.status !== "VALID") {
        continue;
      }

      const tally = block.payload.tally ?? {};

      for (const [countryCode, count] of Object.entries(tally)) {
        accumulated[countryCode] = (accumulated[countryCode] ?? 0) + count;
      }
    }

    return accumulated;
  }

  private calculateEurovisionPoints(
    accumulatedTally: Record<string, number>
  ): Record<string, number> {
    const pointsByRank = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1];

    const ordered = Object.entries(accumulatedTally)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.country.localeCompare(b.country);
      });

    const points: Record<string, number> = {};

    ordered.forEach((item, index) => {
      points[item.country] = pointsByRank[index] ?? 0;
    });

    return points;
  }

  private async verifyBlockchain(
    blocks: VotingResultBlock[]
  ): Promise<VotingResultBlock[]> {
    const sortedBlocks = [...blocks].sort(
      (a, b) => a.payload.index - b.payload.index
    );

    const verifiedBlocks: VotingResultBlock[] = [];

    for (const block of sortedBlocks) {
      if (block.payload.index !== verifiedBlocks.length) {
        throw new Error(
          `Índice inválido en bloque ${block.payload.index}`
        );
      }

      if (verifiedBlocks.length === 0) {
        if (block.payload.previousHash !== "GENESIS") {
          throw new Error("El primer bloque no apunta a GENESIS");
        }
      } else {
        const previousBlock = verifiedBlocks[verifiedBlocks.length - 1];

        if (block.payload.previousHash !== previousBlock.hash) {
          throw new Error(
            `previousHash inválido en bloque ${block.payload.index}`
          );
        }
      }

      const valid = await this.verifyBlockContent(block, verifiedBlocks);

      if (!valid) {
        throw new Error(`Bloque inválido: ${block.payload.index}`);
      }

      verifiedBlocks.push(block);
    }

    return verifiedBlocks;
  }

  private async verifyBlockContent(
    block: VotingResultBlock,
    previousBlocks: VotingResultBlock[]
  ): Promise<boolean> {
    const calculatedHash =
      await this.p2pCryptoService.hashCanonical(block.payload);

    if (calculatedHash !== block.hash) {
      return false;
    }

    if (block.presidentPeerId !== block.payload.roles.presidentPeerId) {
      return false;
    }

    const presidentSignatureValid =
      await this.p2pCryptoService.verifyWithPublicKey(
        {
          payload: block.payload,
          hash: block.hash
        },
        block.presidentSignatureBase64,
        block.payload.roles.presidentVotePublicKey
      );

    if (!presidentSignatureValid) {
      return false;
    }

    if (!(await this.verifyNotaryCommitment(block))) {
      return false;
    }

    if (!(await this.verifyApprovals(block))) {
      return false;
    }

    if (!this.verifyUsedTokenIdsSnapshot(block, previousBlocks)) {
      return false;
    }

    if (block.payload.status === "VALID") {
      return await this.verifyValidBlockPayload(block, previousBlocks);
    }

    if (block.payload.status === "ABORTED") {
      return !block.payload.votes || block.payload.votes.length === 0;
    }

    return false;
  }

  private async verifyNotaryCommitment(
    block: VotingResultBlock
  ): Promise<boolean> {
    const commitment = block.payload.notaryHashCommitment;

    if (!commitment) {
      return block.payload.status === "ABORTED";
    }

    if (commitment.signerPeerId !== block.payload.roles.notaryPeerId) {
      return false;
    }

    return this.p2pCryptoService.verifySignedP2PPayload(
      commitment,
      block.payload.roles.notaryVotePublicKey
    );
  }

  private async verifyApprovals(
    block: VotingResultBlock
  ): Promise<boolean> {
    const approvals = block.approvals ?? [];
    const peersSnapshot = block.payload.peersSnapshot ?? [];

    if (peersSnapshot.length < 3) {
      return false;
    }

    const requiredApprovals =
      Math.floor(peersSnapshot.length / 2) + 1;

    if (approvals.length < requiredApprovals) {
      return false;
    }

    const seenPeerIds = new Set<string>();

    for (const approval of approvals) {
      if (seenPeerIds.has(approval.signerPeerId)) {
        return false;
      }

      seenPeerIds.add(approval.signerPeerId);

      const approvalPayload = approval.payload;

      if (approvalPayload.roundId !== block.payload.roundId) {
        return false;
      }

      if (approvalPayload.roundNumber !== block.payload.roundNumber) {
        return false;
      }

      if (approvalPayload.blockHash !== block.hash) {
        return false;
      }

      if (approvalPayload.decision !== "APPROVED") {
        return false;
      }

      const peer = peersSnapshot.find(
        (item: any) => item.peerId === approval.signerPeerId
      );

      if (!peer?.voterSigningPublicKey) {
        return false;
      }

      const validSignature =
        await this.p2pCryptoService.verifySignedP2PPayload(
          approval,
          peer.voterSigningPublicKey
        );

      if (!validSignature) {
        return false;
      }
    }

    return true;
  }

  private async verifyValidBlockPayload(
    block: VotingResultBlock,
    previousBlocks: VotingResultBlock[]
  ): Promise<boolean> {
    const votes = block.payload.votes;
    const tokenRoundProofs = block.payload.tokenRoundProofs;
    const tally = block.payload.tally;
    const hashes = block.payload.notaryHashCommitment?.payload.votePlainHashes;

    if (!votes || !tokenRoundProofs || !tally || !hashes) {
      return false;
    }

    if (votes.length !== tokenRoundProofs.length) {
      return false;
    }

    if (!(await this.verifyVotesAgainstNotaryHashes(votes, hashes))) {
      return false;
    }

    if (!this.verifyTokenIdsForBlock(block, previousBlocks)) {
      return false;
    }

    const recalculatedTally = this.calculateTally(votes);

    return canonicalJson(recalculatedTally) === canonicalJson(tally);
  }

  private async verifyVotesAgainstNotaryHashes(
    votes: VotePlain[],
    votePlainHashes: string[]
  ): Promise<boolean> {
    if (votes.length !== votePlainHashes.length) {
      return false;
    }

    const remainingHashes = [...votePlainHashes];

    for (const vote of votes) {
      const hash = await this.p2pCryptoService.hashCanonical(vote);
      const index = remainingHashes.indexOf(hash);

      if (index < 0) {
        return false;
      }

      remainingHashes.splice(index, 1);
    }

    return remainingHashes.length === 0;
  }

  private verifyTokenIdsForBlock(
    block: VotingResultBlock,
    previousBlocks: VotingResultBlock[]
  ): boolean {
    const previousUsedTokenIds =
      this.getUsedTokenIdsFromPreviousBlocks(previousBlocks);

    const seenCurrent = new Set<string>();

    for (const proof of block.payload.tokenRoundProofs ?? []) {
      const tokenId = proof.payload?.token?.tokenId;

      if (!tokenId) {
        return false;
      }

      if (seenCurrent.has(tokenId)) {
        return false;
      }

      if (previousUsedTokenIds.has(tokenId)) {
        return false;
      }

      seenCurrent.add(tokenId);
    }

    return true;
  }

  private verifyUsedTokenIdsSnapshot(
    block: VotingResultBlock,
    previousBlocks: VotingResultBlock[]
  ): boolean {
    const previousSnapshot =
      previousBlocks.length === 0
        ? []
        : previousBlocks[previousBlocks.length - 1].payload.usedTokenIdsSnapshot ?? [];

    const currentTokenIds =
      block.payload.status === "VALID"
        ? (block.payload.tokenRoundProofs ?? [])
          .map((proof) => proof.payload?.token?.tokenId)
          .filter((tokenId): tokenId is string => !!tokenId)
        : [];

    const previousSet = new Set(previousSnapshot);

    for (const tokenId of currentTokenIds) {
      if (previousSet.has(tokenId)) {
        return false;
      }
    }

    const expectedSnapshot =
      block.payload.status === "VALID"
        ? Array.from(new Set([...previousSnapshot, ...currentTokenIds])).sort()
        : [...previousSnapshot].sort();

    const receivedSnapshot =
      [...(block.payload.usedTokenIdsSnapshot ?? [])].sort();

    return canonicalJson(expectedSnapshot) === canonicalJson(receivedSnapshot);
  }

  private getUsedTokenIdsFromPreviousBlocks(
    previousBlocks: VotingResultBlock[]
  ): Set<string> {
    if (previousBlocks.length === 0) {
      return new Set();
    }

    return new Set(
      previousBlocks[previousBlocks.length - 1].payload.usedTokenIdsSnapshot ?? []
    );
  }

  private calculateTally(votes: VotePlain[]): Record<string, number> {
    const tally: Record<string, number> = {};

    for (const vote of votes) {
      const countries = vote.approved_countries ?? [];

      for (const countryCode of countries) {
        tally[countryCode] = (tally[countryCode] ?? 0) + 1;
      }
    }

    return tally;
  }
}