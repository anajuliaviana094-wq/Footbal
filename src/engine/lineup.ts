import { FORMATION_SLOTS, positionFit } from "./formations";
import { computeOverall } from "./ratings";
import type { EnginePlayer, Formation } from "./types";

/** Nota de um jogador para um papel, considerando condição física. */
export function roleScore(p: EnginePlayer, role: EnginePlayer["position"]): number {
  return computeOverall(p.attrs, role) * positionFit(p.position, role) * (0.7 + 0.3 * (p.condition / 100));
}

/**
 * Escolhe 11 titulares (na ordem dos slots) e até 9 reservas entre os disponíveis.
 * Guloso por escassez: goleiro primeiro, depois defesa → ataque.
 */
export function pickBestXI(
  available: EnginePlayer[],
  formation: Formation,
  benchSize = 9,
): { starters: EnginePlayer[]; bench: EnginePlayer[] } {
  const slots = FORMATION_SLOTS[formation];
  const used = new Set<number>();
  const starters: (EnginePlayer | null)[] = slots.map(() => null);
  const order = slots.map((s, i) => i).sort((a, b) => scarcity(slots[a].role) - scarcity(slots[b].role));
  for (const i of order) {
    let best: EnginePlayer | null = null;
    let bestScore = -1;
    for (const p of available) {
      if (used.has(p.id)) continue;
      const s = roleScore(p, slots[i].role);
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      starters[i] = best;
    }
  }
  const rest = available.filter((p) => !used.has(p.id));
  const bench: EnginePlayer[] = [];
  const gk = rest.filter((p) => p.position === "GOL").sort((a, b) => roleScore(b, "GOL") - roleScore(a, "GOL"))[0];
  if (gk) bench.push(gk);
  const others = rest
    .filter((p) => p !== gk)
    .sort((a, b) => roleScore(b, b.position) - roleScore(a, a.position));
  for (const p of others) {
    if (bench.length >= benchSize) break;
    bench.push(p);
  }
  return { starters: starters.filter((p): p is EnginePlayer => p !== null), bench };
}

function scarcity(role: EnginePlayer["position"]): number {
  return { GOL: 0, ZAG: 1, LAT: 2, VOL: 3, ATA: 4, MEI: 5, PON: 6, MC: 7 }[role];
}
