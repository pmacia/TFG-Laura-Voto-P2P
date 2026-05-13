import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { PublicBlockchainService } from "../../services/public-blockchain.service";
import { P2PCryptoService } from "../../services/p2p-crypto.service";
import {
  BlockApproval,
  TokenRoundProof,
  VotingResultBlock
} from "../../../shared/models/p2p-message.models";
import { VotePlain } from "../../../shared/models/vote.model";
import { canonicalJson } from "../../utils/canonical-json.util";
import { ActivatedRoute } from "@angular/router";
import { Router } from "@angular/router";

@Component({
  selector: "app-results",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./results.component.html",
  styleUrl: "./results.component.scss"
})
export class ResultsComponent implements OnInit {
  loading = false;
  errorMessage = "";
  successMessage = "";

  blocks: VotingResultBlock[] = [];
  verifiedBlocks: VotingResultBlock[] = [];

  accumulatedTally: Record<string, number> = {};
  finalPoints: Record<string, number> = {};

  localReceipt: any | null = null;
  countryCode: string | null = null;
  countryName = "ANCC local";
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
    private route: ActivatedRoute,
    private router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadResults();
  }

  async loadResults(): Promise<void> {
    try {
      this.loading = true;
      this.errorMessage = "";
      this.successMessage = "";

      this.localReceipt = this.loadLocalVoteReceipt();

      const country = this.route.snapshot.queryParamMap.get("country");
      const baseUrl = this.route.snapshot.queryParamMap.get("baseUrl");

      this.countryCode = country?.toUpperCase() ?? null;
      this.countryName = this.countryCode
        ? this.countryNames[this.countryCode] ?? this.countryCode
        : "ANCC local";

      this.blocks = baseUrl
        ? await this.publicBlockchainService.getBlocksFromBaseUrl(baseUrl)
        : await this.publicBlockchainService.getBlocks();

      this.verifiedBlocks = await this.verifyBlockchain(this.blocks);

      this.accumulatedTally =
        this.calculateAccumulatedVoteCountsFromBlockchain(this.verifiedBlocks);

      this.finalPoints =
        this.calculateFinalEurovisionPoints(this.accumulatedTally);

      this.successMessage =
        `Blockchain verificada correctamente: ${this.verifiedBlocks.length} bloque(s).`;
    } catch (error: any) {
      this.errorMessage =
        error?.message ?? "No se pudieron cargar los resultados";
    } finally {
      this.loading = false;
    }
  }

  expandedBlockHashes = new Set<string>();

  toggleBlockDetails(blockHash: string): void {
    if (this.expandedBlockHashes.has(blockHash)) {
      this.expandedBlockHashes.delete(blockHash);
    } else {
      this.expandedBlockHashes.add(blockHash);
    }
  }

  isBlockExpanded(blockHash: string): boolean {
    return this.expandedBlockHashes.has(blockHash);
  }

  goToGlobalResults(): void {
    this.router.navigate(["/global-results"]);
  }

  getCountryName(countryCode: string): string {
    return this.countryNames[countryCode?.toUpperCase()] ?? countryCode;
  }

  private loadLocalVoteReceipt(): any | null {
    const raw = localStorage.getItem("tfg_vote_receipt");

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  isLocalReceiptBlock(block: VotingResultBlock): boolean {
    return this.localReceipt?.acceptedBlockHash === block.hash;
  }

  get verifiedBlocksList(): VotingResultBlock[] {
    return this.verifiedBlocks;
  }

  get accumulatedTallyList(): Array<{ country: string; count: number }> {
    return Object.entries(this.accumulatedTally)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }

  get finalPointsList(): Array<{ country: string; points: number }> {
    return Object.entries(this.finalPoints)
      .map(([country, points]) => ({ country, points }))
      .sort((a, b) => b.points - a.points);
  }

  getBlockTallyList(block: VotingResultBlock): Array<{ country: string; count: number }> {
    return Object.entries(block.payload.tally ?? {})
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
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

  private calculateFinalEurovisionPoints(
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
      console.error("Hash de bloque inválido", block);
      return false;
    }

    if (block.presidentPeerId !== block.payload.roles.presidentPeerId) {
      console.error("presidentPeerId no coincide con roles", block);
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
      console.error("Firma del presidente inválida", block);
      return false;
    }

    if (!(await this.verifyNotaryCommitment(block))) {
      return false;
    }

    if (!(await this.verifyBlockApprovals(block))) {
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

  private async verifyBlockApprovals(
    block: VotingResultBlock
  ): Promise<boolean> {
    const approvals = block.approvals ?? [];
    const peersSnapshot = block.payload.peersSnapshot ?? [];

    if (peersSnapshot.length < 3) {
      console.error("El bloque no contiene peersSnapshot suficiente", block);
      return false;
    }

    const requiredApprovals =
      Math.floor(peersSnapshot.length / 2) + 1;

    if (approvals.length < requiredApprovals) {
      console.error("Quórum insuficiente", {
        approvals: approvals.length,
        requiredApprovals
      });
      return false;
    }

    const seenPeerIds = new Set<string>();

    for (const approval of approvals) {
      if (seenPeerIds.has(approval.signerPeerId)) {
        return false;
      }

      seenPeerIds.add(approval.signerPeerId);

      const valid = await this.verifyBlockApprovalForBlock(
        block,
        approval
      );

      if (!valid) {
        return false;
      }
    }

    return true;
  }

  private async verifyBlockApprovalForBlock(
    block: VotingResultBlock,
    approval: BlockApproval
  ): Promise<boolean> {
    const payload = approval.payload;

    if (payload.roundId !== block.payload.roundId) return false;
    if (payload.roundNumber !== block.payload.roundNumber) return false;
    if (payload.blockHash !== block.hash) return false;
    if (payload.decision !== "APPROVED") return false;

    const peer = block.payload.peersSnapshot?.find(
      (item: any) => item.peerId === approval.signerPeerId
    );

    if (!peer?.voterSigningPublicKey) {
      return false;
    }

    return this.p2pCryptoService.verifySignedP2PPayload(
      approval,
      peer.voterSigningPublicKey
    );
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
