import { Rng } from "@/engine/rng";

export const MIN_SQUAD = 16;
export const MAX_SQUAD = 32;
export const OFFER_DAYS = 2;

/** Preço que um clube da IA pede por um jogador. */
export function aiAskingPrice(value: number, isKeyPlayer: boolean, sellerRich: boolean, scarce = false): number {
  const k = (isKeyPlayer ? 1.45 : 1.1) * (sellerRich ? 1.1 : 0.95) * (isKeyPlayer && scarce ? 1.25 : 1);
  return Math.round((value * k) / 5_000) * 5_000;
}

export interface BidContext {
  fee: number;
  wage: number;
  value: number;
  currentWage: number;
  isKeyPlayer: boolean;
  sellerSquadSize: number;
  samePositionCount: number;
  sellerRich: boolean;
  buyerStrength: number;
  sellerStrength: number;
}

export type BidResult =
  | { accepted: true; message: string }
  | { accepted: false; message: string; counterFee?: number };

/** Decisão do clube (e do jogador) da IA diante de uma proposta. */
export function evaluateBid(b: BidContext): BidResult {
  if (b.sellerSquadSize <= MIN_SQUAD) return { accepted: false, message: "O clube não pode reduzir mais o elenco." };
  const asking = aiAskingPrice(b.value, b.isKeyPlayer, b.sellerRich, b.samePositionCount <= 2);
  if (b.fee < asking) {
    return { accepted: false, message: `Proposta recusada. O clube pede ${asking.toLocaleString("pt-BR")}.`, counterFee: asking };
  }
  // o jogador aceita ir para um clube menor só ganhando bem mais
  const gap = b.sellerStrength - b.buyerStrength;
  const needWage = b.currentWage * (gap > 6 ? 1.6 : gap > 0 ? 1.2 : 1.05);
  if (b.wage < needWage) {
    return { accepted: false, message: `O jogador recusou: pede salário de ${Math.round(needWage).toLocaleString("pt-BR")}/mês.` };
  }
  return { accepted: true, message: "Proposta aceita! O jogador já é do seu clube." };
}

/** Chance de um clube da IA fazer proposta por um jogador do usuário neste dia de jogo. */
export function aiInterestChance(p: { listed: boolean; overall: number; squadAvg: number }): number {
  if (p.listed) return 0.4;
  return p.overall >= p.squadAvg + 4 ? 0.035 : 0.006;
}

export function aiOfferFee(rng: Rng, value: number, listed: boolean, askingPrice: number | null): number {
  const base = listed ? (askingPrice ?? value) * rng.range(0.82, 1.05) : value * rng.range(1.15, 1.6);
  return Math.round(base / 5_000) * 5_000;
}
