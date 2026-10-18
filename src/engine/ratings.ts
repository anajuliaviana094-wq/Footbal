import type { Attributes, Position } from "./types";

type Weights = Partial<Record<keyof Attributes, number>>;

export const POSITION_WEIGHTS: Record<Position, Weights> = {
  GOL: { reflexo: 4, posicionamento: 3, saida_gol: 2, jogo_pes: 1 },
  ZAG: { desarme: 3, marcacao: 3, cabeceio: 2, forca: 2, posicionamento: 2, velocidade: 1, passe: 1 },
  LAT: { velocidade: 3, cruzamento: 2, desarme: 2, marcacao: 2, resistencia: 2, passe: 1, drible: 1 },
  VOL: { desarme: 3, marcacao: 3, passe: 2, posicionamento: 2, resistencia: 2, forca: 1, visao: 1 },
  MC: { passe: 3, visao: 2, resistencia: 2, desarme: 1, drible: 1, finalizacao: 1, posicionamento: 1 },
  MEI: { passe: 3, visao: 3, drible: 2, finalizacao: 2, posicionamento: 1 },
  PON: { velocidade: 3, drible: 3, cruzamento: 2, finalizacao: 1, passe: 1 },
  ATA: { finalizacao: 4, posicionamento: 2, cabeceio: 2, velocidade: 1, forca: 1, drible: 1 },
};

export function computeOverall(attrs: Attributes, pos: Position): number {
  const w = POSITION_WEIGHTS[pos];
  let sum = 0;
  let total = 0;
  for (const [k, v] of Object.entries(w) as [keyof Attributes, number][]) {
    sum += attrs[k] * v;
    total += v;
  }
  return Math.round(sum / total);
}

export function clampAttr(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}

/** Aplica evolução (+/-) da carreira em todos os atributos. */
export function applyProgression(attrs: Attributes, delta: number): Attributes {
  if (!delta) return attrs;
  const out = { ...attrs };
  for (const k of Object.keys(out) as (keyof Attributes)[]) out[k] = clampAttr(out[k] + delta);
  return out;
}
