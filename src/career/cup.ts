import { Rng } from "@/engine/rng";

export function cupStageCount(teams: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, teams))));
}

export function cupStageName(stage: number, total: number): string {
  const left = total - stage;
  if (left === 0) return "Final";
  if (left === 1) return "Semifinal";
  if (left === 2) return "Quartas de final";
  if (left === 3) return "Oitavas de final";
  return `${stage}ª fase`;
}

/**
 * Primeira fase do mata-mata. Para fechar uma chave de 2^n, os mais fortes ganham "bye"
 * (vão direto para a 2ª fase). `clubs` deve vir ordenado do mais forte para o mais fraco.
 */
export function firstCupStage(clubs: number[], seed: number): { pairs: [number, number][]; byes: number[] } {
  const size = 2 ** cupStageCount(clubs.length);
  const byeCount = size - clubs.length;
  const byes = clubs.slice(0, byeCount);
  const rest = new Rng(seed).shuffle(clubs.slice(byeCount));
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]]);
  return { pairs, byes };
}

/** Sorteio da fase seguinte entre os classificados. */
export function nextCupStage(qualified: number[], seed: number): [number, number][] {
  const list = new Rng(seed).shuffle([...qualified]);
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
  return pairs;
}
