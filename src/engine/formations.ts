import type { Formation, Position } from "./types";

export interface Slot {
  role: Position;
  /** x: 0 = próprio gol, 1 = gol adversário. y: 0 = topo, 1 = base. */
  x: number;
  y: number;
}

const GK: Slot = { role: "GOL", x: 0.05, y: 0.5 };
const BACK4: Slot[] = [
  { role: "LAT", x: 0.25, y: 0.12 },
  { role: "ZAG", x: 0.2, y: 0.37 },
  { role: "ZAG", x: 0.2, y: 0.63 },
  { role: "LAT", x: 0.25, y: 0.88 },
];

export const FORMATION_SLOTS: Record<Formation, Slot[]> = {
  "4-4-2": [
    GK,
    ...BACK4,
    { role: "PON", x: 0.5, y: 0.14 },
    { role: "MC", x: 0.45, y: 0.4 },
    { role: "MC", x: 0.45, y: 0.6 },
    { role: "PON", x: 0.5, y: 0.86 },
    { role: "ATA", x: 0.72, y: 0.4 },
    { role: "ATA", x: 0.72, y: 0.6 },
  ],
  "4-3-3": [
    GK,
    ...BACK4,
    { role: "VOL", x: 0.38, y: 0.5 },
    { role: "MC", x: 0.48, y: 0.3 },
    { role: "MC", x: 0.48, y: 0.7 },
    { role: "PON", x: 0.7, y: 0.15 },
    { role: "ATA", x: 0.76, y: 0.5 },
    { role: "PON", x: 0.7, y: 0.85 },
  ],
  "4-2-3-1": [
    GK,
    ...BACK4,
    { role: "VOL", x: 0.38, y: 0.38 },
    { role: "VOL", x: 0.38, y: 0.62 },
    { role: "PON", x: 0.6, y: 0.15 },
    { role: "MEI", x: 0.58, y: 0.5 },
    { role: "PON", x: 0.6, y: 0.85 },
    { role: "ATA", x: 0.77, y: 0.5 },
  ],
  "3-5-2": [
    GK,
    { role: "ZAG", x: 0.2, y: 0.3 },
    { role: "ZAG", x: 0.18, y: 0.5 },
    { role: "ZAG", x: 0.2, y: 0.7 },
    { role: "LAT", x: 0.45, y: 0.1 },
    { role: "VOL", x: 0.38, y: 0.5 },
    { role: "MC", x: 0.5, y: 0.32 },
    { role: "MC", x: 0.5, y: 0.68 },
    { role: "LAT", x: 0.45, y: 0.9 },
    { role: "ATA", x: 0.72, y: 0.4 },
    { role: "ATA", x: 0.72, y: 0.6 },
  ],
  "5-3-2": [
    GK,
    { role: "LAT", x: 0.28, y: 0.1 },
    { role: "ZAG", x: 0.18, y: 0.3 },
    { role: "ZAG", x: 0.16, y: 0.5 },
    { role: "ZAG", x: 0.18, y: 0.7 },
    { role: "LAT", x: 0.28, y: 0.9 },
    { role: "MC", x: 0.45, y: 0.3 },
    { role: "VOL", x: 0.4, y: 0.5 },
    { role: "MC", x: 0.45, y: 0.7 },
    { role: "ATA", x: 0.7, y: 0.4 },
    { role: "ATA", x: 0.7, y: 0.6 },
  ],
};

/** Quão bem um jogador de posição `pos` atua no papel `role` (0–1). */
export function positionFit(pos: Position, role: Position): number {
  if (pos === role) return 1;
  if (pos === "GOL" || role === "GOL") return 0.3;
  const groups: Position[][] = [
    ["ZAG", "VOL"],
    ["LAT", "PON"],
    ["VOL", "MC"],
    ["MC", "MEI"],
    ["MEI", "PON"],
    ["MEI", "ATA"],
    ["PON", "ATA"],
    ["LAT", "ZAG"],
  ];
  for (const [a, b] of groups) {
    if ((a === pos && b === role) || (b === pos && a === role)) return 0.88;
  }
  return 0.72;
}
