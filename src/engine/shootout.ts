import { Rng } from "./rng";
import type { EnginePlayer } from "./types";

function scoreChance(taker: EnginePlayer, gk: EnginePlayer | undefined): number {
  const skill = (taker.attrs.finalizacao * 0.6 + taker.traits.frieza * 0.4) / 100;
  const keeper = gk ? gk.attrs.reflexo / 100 : 0.5;
  return Math.max(0.45, Math.min(0.92, 0.66 + 0.25 * skill - 0.15 * keeper));
}

/** Disputa de pênaltis: 5 cobranças e depois alternadas até alguém errar. */
export function penaltyShootout(
  home: { takers: EnginePlayer[]; gk?: EnginePlayer },
  away: { takers: EnginePlayer[]; gk?: EnginePlayer },
  seed: number,
): { home: number; away: number } {
  const rng = new Rng(seed);
  const order = (t: EnginePlayer[]) =>
    [...t].sort((a, b) => b.attrs.finalizacao + b.traits.frieza - (a.attrs.finalizacao + a.traits.frieza));
  const ht = order(home.takers);
  const at = order(away.takers);
  let h = 0;
  let a = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.chance(scoreChance(ht[i % ht.length], away.gk))) h++;
    if (h > a + (5 - i)) break; // já decidido
    if (rng.chance(scoreChance(at[i % at.length], home.gk))) a++;
    if (a > h + (4 - i) || h > a + (4 - i)) break;
  }
  for (let i = 5; h === a && i < 60; i++) {
    const hs = rng.chance(scoreChance(ht[i % ht.length], away.gk));
    const as = rng.chance(scoreChance(at[i % at.length], home.gk));
    if (hs) h++;
    if (as) a++;
  }
  if (h === a) h++; // garantia
  return { home: h, away: a };
}
