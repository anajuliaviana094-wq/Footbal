import { marketValue } from "@/seed/generate";

/** Multiplicador financeiro da liga (ligas mais fortes movimentam mais dinheiro). */
export function leagueMultiplier(level: number): number {
  return Math.pow(1.17, level - 64);
}

/** "Unidade" financeira da liga ≈ folha semanal de um clube médio. */
export function leagueUnit(level: number): number {
  return 62_500 * leagueMultiplier(level);
}

/** Salário mensal na carreira a partir do salário-base do seed. */
export function careerWage(baseWage: number): number {
  return Math.round((baseWage * 5) / 500) * 500;
}

/** Salário pedido por um jogador com determinado valor de mercado. */
export function wageForValue(value: number): number {
  return Math.max(5_000, Math.round((value * 0.0225) / 500) * 500);
}

/** Valor de mercado dinâmico: geral, idade, potencial e fase (nota média). */
export function playerMarketValue(p: { overall: number; age: number; potential: number; avgRating: number | null; appearances: number }): number {
  let v = marketValue(p.overall, p.age);
  if (p.age <= 23) v *= 1 + Math.max(0, p.potential - p.overall) * 0.04;
  if (p.avgRating !== null && p.appearances >= 3) v *= Math.max(0.8, Math.min(1.3, 1 + (p.avgRating - 6.5) * 0.2));
  return Math.max(25_000, Math.round(v / 5_000) * 5_000);
}

export function initialBalance(level: number, strength: number): number {
  const rep = Math.max(0.5, 1 + (strength - level) * 0.08);
  return Math.round((leagueUnit(level) * 70 * rep) / 10_000) * 10_000;
}

export function stadiumCapacity(level: number, strength: number): number {
  return Math.round((12_000 + Math.max(0, strength - level + 8) * 2_400 + (level - 60) * 600) / 500) * 500;
}

/** Receitas de um dia de jogo de liga. */
export function matchdayIncome(opts: {
  level: number;
  strength: number;
  capacity: number;
  isHome: boolean;
  /** 0–1: fase recente (pontos dos últimos jogos) */
  form: number;
}): { tv: number; sponsor: number; ticket: number } {
  const u = leagueUnit(opts.level);
  const rep = Math.max(0.6, 1 + (opts.strength - opts.level) * 0.05);
  const fill = Math.min(1, 0.45 + 0.4 * opts.form + 0.05 * rep);
  const pricePerFan = (u * 0.9) / (27_000 * 0.65);
  return {
    tv: Math.round(u * 0.45),
    sponsor: Math.round(u * 0.35 * rep),
    ticket: opts.isHome ? Math.round(opts.capacity * fill * pricePerFan) : 0,
  };
}

/** Prêmio de fim de temporada pela posição na liga. */
export function leaguePrize(level: number, position: number, teams: number): number {
  const u = leagueUnit(level);
  return Math.round(u * (5 + 25 * ((teams - position) / (teams - 1))));
}

/** Prêmio da copa por fase alcançada (stage = fase em que caiu, ou total+1 para o campeão). */
export function cupPrize(level: number, stageReached: number, totalStages: number): number {
  const u = leagueUnit(level);
  if (stageReached > totalStages) return Math.round(u * 15);
  return Math.round(u * 1.5 * stageReached);
}

export function academyUpgradeCost(level: number, academyLevel: number): number {
  return Math.round((leagueUnit(level) * 18 * academyLevel) / 10_000) * 10_000;
}

/** Potencial médio esperado da base. */
export function youthQuality(academyLevel: number, clubStrength: number): number {
  return 56 + academyLevel * 5 + (clubStrength - 65) * 0.5;
}

export const MAX_ACADEMY_LEVEL = 5;
