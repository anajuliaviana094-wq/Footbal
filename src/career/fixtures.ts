import { Rng } from "@/engine/rng";

export interface FixtureDef {
  round: number;
  home: number;
  away: number;
}

/** Pontos corridos, turno e returno (método do círculo), com mando alternado. */
export function doubleRoundRobin(clubIds: number[], seed: number): FixtureDef[] {
  const rng = new Rng(seed);
  const teams = rng.shuffle([...clubIds]);
  if (teams.length % 2) teams.push(-1);
  const n = teams.length;
  const rounds = n - 1;
  const firstLeg: FixtureDef[] = [];
  const arr = [...teams];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === -1 || b === -1) continue;
      const swap = (i === 0 && r % 2 === 1) || (i > 0 && (r + i) % 2 === 1);
      firstLeg.push({ round: r + 1, home: swap ? b : a, away: swap ? a : b });
    }
    // rotaciona mantendo o primeiro fixo
    arr.splice(1, 0, arr.pop()!);
  }
  const secondLeg = firstLeg.map((f) => ({ round: f.round + rounds, home: f.away, away: f.home }));
  return [...firstLeg, ...secondLeg];
}
