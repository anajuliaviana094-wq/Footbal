import { FAMOUS_NAME_BLOCKLIST, LEAGUES, type LeagueDef, type NamePool } from "@/data/leagues";
import ar from "@/data/names/ar.json";
import br from "@/data/names/br.json";
import de from "@/data/names/de.json";
import en from "@/data/names/en.json";
import es from "@/data/names/es.json";
import fr from "@/data/names/fr.json";
import itPool from "@/data/names/it.json";
import ng from "@/data/names/ng.json";
import pt from "@/data/names/pt.json";
import sa from "@/data/names/sa.json";
import { computeOverall, clampAttr } from "@/engine/ratings";
import { Rng, hashSeed } from "@/engine/rng";
import type { Attributes, Formation, Position, Traits } from "@/engine/types";
import { ARCHETYPES, ARCHETYPE_BY_ID, POSITION_BIAS, SQUAD_TEMPLATE, type Archetype } from "./archetypes";

export const SEED = 20260101;

interface Pool {
  nationality: string;
  first: string[];
  last: string[];
}
const POOLS: Record<NamePool, Pool> = { br, en, es, it: itPool, de, fr, sa, pt, ar, ng };

export type CrestShape = "shield" | "circle" | "diamond" | "hex" | "badge";
export type CrestPattern = "solid" | "stripes" | "half" | "band" | "chevron" | "cross" | "hoops";

export interface CrestSpec {
  shape: CrestShape;
  pattern: CrestPattern;
  initials: string;
  primary: string;
  secondary: string;
  star: boolean;
}

export interface SeedLeague {
  id: string;
  name: string;
  country: string;
  flag: string;
  inspiration: string;
  level: number;
  isFree: boolean;
  sortOrder: number;
}

export interface SeedClub {
  id: number;
  leagueId: string;
  name: string;
  shortName: string;
  city: string;
  stadium: string;
  primaryColor: string;
  secondaryColor: string;
  crest: CrestSpec;
  strength: number;
  defaultFormation: Formation;
}

export interface SeedPlayer {
  id: number;
  clubId: number;
  firstName: string;
  lastName: string;
  shortName: string;
  nationality: string;
  age: number;
  position: Position;
  foot: "D" | "E" | "A";
  height: number;
  archetype: string;
  attrs: Attributes;
  traits: Traits;
  potential: number;
  overall: number;
  value: number;
  wage: number;
  shirtNumber: number;
}

const COLOR_PAIRS: [string, string][] = [
  ["#c8102e", "#ffffff"], ["#0b3d91", "#ffffff"], ["#111111", "#ffffff"], ["#0a7d3b", "#ffffff"],
  ["#f2c200", "#0b3d91"], ["#5b2a86", "#ffffff"], ["#e35205", "#111111"], ["#7a0019", "#f2c200"],
  ["#00a3e0", "#ffffff"], ["#0a7d3b", "#f2c200"], ["#c8102e", "#111111"], ["#1d2951", "#c8102e"],
  ["#ffffff", "#c8102e"], ["#ffffff", "#0b3d91"], ["#8a1538", "#7fb2e5"], ["#006b5e", "#f4f4f4"],
  ["#2b2b2b", "#f2c200"], ["#9b111e", "#0b3d91"], ["#4b9cd3", "#13294b"], ["#ff6f00", "#ffffff"],
];
const SHAPES: CrestShape[] = ["shield", "circle", "diamond", "hex", "badge"];
const PATTERNS: CrestPattern[] = ["solid", "stripes", "half", "band", "chevron", "cross", "hoops"];
const FORMATION_CHOICES: Formation[] = ["4-4-2", "4-3-3", "4-2-3-1", "4-4-2", "4-3-3", "3-5-2", "5-3-2", "4-2-3-1"];
const ATTR_KEYS: (keyof Attributes)[] = [
  "finalizacao", "passe", "drible", "cruzamento", "cabeceio", "desarme", "marcacao", "posicionamento",
  "velocidade", "resistencia", "forca", "visao", "reflexo", "saida_gol", "jogo_pes",
];
const TRAIT_KEYS: (keyof Traits)[] = [
  "agressividade", "temperamento", "frieza", "lideranca", "disciplina_tatica", "propensao_lesao", "consistencia",
];

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function initialsOf(name: string, short: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 2 && w[0] === w[0].toUpperCase());
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return short.slice(0, 2);
}

function pickAge(rng: Rng): number {
  return rng.weighted(
    [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
    [1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 7, 6, 5, 4, 3, 2, 1.5, 1, 0.5],
  );
}

function marketValue(overall: number, age: number): number {
  const ageFactor = age <= 21 ? 1.4 : age <= 27 ? 1.2 : age <= 30 ? 1 : age <= 32 ? 0.6 : 0.35;
  const v = 0.05 * Math.pow(1.17, overall - 50) * ageFactor; // milhões
  return Math.max(25_000, Math.round((v * 1_000_000) / 5000) * 5000);
}

function chooseArchetype(rng: Rng, pos: Position, age: number): Archetype {
  if (age >= 32 && pos !== "GOL" && rng.chance(0.55)) return ARCHETYPE_BY_ID.get("veterano_experiente")!;
  if (age <= 20 && rng.chance(0.6)) return ARCHETYPE_BY_ID.get("jovem_promessa")!;
  const options = ARCHETYPES.filter((a) => a.positions.includes(pos));
  return rng.pick(options);
}

function genTraits(rng: Rng, arch: Archetype, age: number): Traits {
  const t = {} as Traits;
  for (const k of TRAIT_KEYS) {
    const range = arch.traits[k];
    t[k] = range ? rng.int(range[0], range[1]) : clampAttr(rng.gauss(50, 15));
  }
  // idade influencia liderança/consistência
  if (age >= 29) t.lideranca = clampAttr(t.lideranca + 6);
  if (age <= 21) t.consistencia = clampAttr(t.consistencia - 6);
  return t;
}

function genAttrs(rng: Rng, pos: Position, arch: Archetype, target: number): Attributes {
  const posBias = POSITION_BIAS[pos];
  const a = {} as Attributes;
  for (const k of ATTR_KEYS) {
    let base = target + (posBias[k] ?? -12) + (arch.bias[k] ?? 0) + rng.gauss(0, 4);
    if (pos !== "GOL" && (k === "reflexo" || k === "saida_gol")) base = rng.int(5, 25);
    if (pos !== "GOL" && k === "jogo_pes") base = rng.int(10, 35);
    a[k] = clampAttr(base);
  }
  // ajusta para que o overall bata com o alvo
  for (let i = 0; i < 3; i++) {
    const diff = target - computeOverall(a, pos);
    if (Math.abs(diff) < 1) break;
    for (const k of ATTR_KEYS) {
      if (pos !== "GOL" && (k === "reflexo" || k === "saida_gol" || k === "jogo_pes")) continue;
      a[k] = clampAttr(a[k] + diff);
    }
  }
  return a;
}

function genHeight(rng: Rng, pos: Position, arch: Archetype): number {
  if (pos === "GOL") return rng.int(184, 198);
  if (pos === "ZAG" || arch.id === "centroavante_pivo") return rng.int(181, 196);
  if (pos === "PON" || pos === "MEI") return rng.int(165, 182);
  return rng.int(170, 189);
}

/** Números de camisa preferenciais por posição. */
const SHIRT_PREFS: Record<Position, number[]> = {
  GOL: [1, 12, 23, 31, 40],
  ZAG: [3, 4, 14, 15, 24, 33],
  LAT: [2, 6, 13, 16, 22, 26],
  VOL: [5, 8, 25, 28, 35],
  MC: [8, 17, 18, 20, 27, 29],
  MEI: [10, 19, 21, 30],
  PON: [7, 11, 17, 19, 77],
  ATA: [9, 11, 19, 32, 99],
};

export function generateWorld(seed = SEED): { leagues: SeedLeague[]; clubs: SeedClub[]; players: SeedPlayer[] } {
  const leagues: SeedLeague[] = [];
  const clubs: SeedClub[] = [];
  const players: SeedPlayer[] = [];
  let clubId = 1;
  let playerId = 1;

  for (const def of LEAGUES) {
    const rng = new Rng(hashSeed(seed, def.id));
    leagues.push({
      id: def.id,
      name: def.name,
      country: def.country,
      flag: def.flag,
      inspiration: def.inspiration,
      level: def.level,
      isFree: def.isFree,
      sortOrder: def.sortOrder,
    });

    const n = def.clubs.length;
    const order = rng.shuffle(def.clubs.map((_, i) => i));
    const colorOrder = rng.shuffle(COLOR_PAIRS.map((_, i) => i));

    def.clubs.forEach((c, i) => {
      const rank = order.indexOf(i);
      const strength = Math.round(def.level + 6 - (12 * rank) / (n - 1) + rng.gauss(0, 1));
      const [primary, secondary] = COLOR_PAIRS[colorOrder[i % colorOrder.length]];
      const club: SeedClub = {
        id: clubId++,
        leagueId: def.id,
        name: c.name,
        shortName: c.short,
        city: c.city,
        stadium: rng.chance(0.5) ? `Arena ${c.city}` : `Estádio Municipal de ${c.city}`,
        primaryColor: primary,
        secondaryColor: secondary,
        crest: {
          shape: rng.pick(SHAPES),
          pattern: rng.pick(PATTERNS),
          initials: initialsOf(c.name, c.short),
          primary,
          secondary,
          star: rng.chance(0.3),
        },
        strength,
        defaultFormation: rng.pick(FORMATION_CHOICES),
      };
      clubs.push(club);
      players.push(...generateSquad(rng, def, club, () => playerId++));
    });
  }
  return { leagues, clubs, players };
}

function generateSquad(rng: Rng, def: LeagueDef, club: SeedClub, nextId: () => number): SeedPlayer[] {
  const squad: SeedPlayer[] = [];
  const usedNames = new Set<string>();
  const usedShort = new Set<string>();
  const usedShirts = new Set<number>();
  const posCount: Partial<Record<Position, number>> = {};
  const starterSlots: Record<Position, number> = { GOL: 1, ZAG: 2, LAT: 2, VOL: 2, MC: 2, MEI: 1, PON: 2, ATA: 2 };

  for (const pos of SQUAD_TEMPLATE) {
    const k = (posCount[pos] = (posCount[pos] ?? 0) + 1);
    const tier = k <= starterSlots[pos] ? 0 : k === starterSlots[pos] + 1 ? 1 : 2;
    const age = pickAge(rng);
    const arch = chooseArchetype(rng, pos, age);
    let target = club.strength + [0, -5, -9][tier] + rng.gauss(0, 3);
    if (age <= 20) target -= 5;
    else if (age <= 22) target -= 2;
    else if (age >= 34) target -= 2;
    target = Math.max(38, Math.min(92, Math.round(target)));

    const attrs = genAttrs(rng, pos, arch, target);
    const overall = computeOverall(attrs, pos);
    const traits = genTraits(rng, arch, age);
    const potential = Math.min(
      95,
      overall + (age <= 19 ? rng.int(6, 18) : age <= 21 ? rng.int(3, 12) : age <= 24 ? rng.int(0, 6) : 0),
    );

    // nacionalidade e nome
    const poolKey: NamePool = rng.chance(def.foreignRate)
      ? rng.weighted(Object.keys(def.foreignPools) as NamePool[], Object.values(def.foreignPools) as number[])
      : def.pool;
    const pool = POOLS[poolKey];
    let first = "";
    let last = "";
    for (let attempt = 0; attempt < 40; attempt++) {
      first = rng.pick(pool.first);
      last = rng.pick(pool.last);
      const full = normalize(`${first} ${last}`);
      if (!FAMOUS_NAME_BLOCKLIST.has(full) && !usedNames.has(full)) break;
    }
    usedNames.add(normalize(`${first} ${last}`));
    let shortName = poolKey === "br" && rng.chance(0.45) ? first : last;
    if (usedShort.has(shortName)) shortName = poolKey === "br" ? `${first} ${last[0]}.` : `${first[0]}. ${last}`;
    if (usedShort.has(shortName)) shortName = `${first} ${last}`;
    usedShort.add(shortName);

    let shirt = SHIRT_PREFS[pos].find((s) => !usedShirts.has(s));
    if (shirt === undefined) {
      shirt = 2;
      while (usedShirts.has(shirt)) shirt++;
    }
    usedShirts.add(shirt);

    const value = marketValue(overall, age);
    squad.push({
      id: nextId(),
      clubId: club.id,
      firstName: first,
      lastName: last,
      shortName,
      nationality: pool.nationality,
      age,
      position: pos,
      foot: rng.weighted(["D", "E", "A"] as const, [75, 20, 5]),
      height: genHeight(rng, pos, arch),
      archetype: arch.id,
      attrs,
      traits,
      potential: Math.max(potential, overall),
      overall,
      value,
      wage: Math.max(3_000, Math.round((value * 0.0045) / 500) * 500),
      shirtNumber: shirt,
    });
  }
  return squad;
}
