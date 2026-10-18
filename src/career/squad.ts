import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { schema } from "@/db";
import { FORMATION_SLOTS } from "@/engine/formations";
import { pickBestXI, roleScore } from "@/engine/lineup";
import { applyProgression, computeOverall } from "@/engine/ratings";
import { Rng, hashSeed } from "@/engine/rng";
import type { Attributes, EnginePlayer, Pressing, Style, Tactics, TeamInput, Traits, Position } from "@/engine/types";
import { isAvailable } from "./rules";

export interface SquadPlayer {
  id: number;
  clubId: number;
  name: string;
  firstName: string;
  lastName: string;
  shirt: number;
  position: Position;
  age: number;
  nationality: string;
  foot: string;
  height: number;
  archetype: string;
  overall: number;
  potential: number;
  attrs: Attributes;
  traits: Traits;
  value: number;
  wage: number;
  condition: number;
  morale: number;
  yellowAccum: number;
  suspendedRounds: number;
  injuryDays: number;
  available: boolean;
  appearances: number;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
  avgRating: number | null;
  scoutReport: string | null;
}

type PlayerRow = typeof schema.players.$inferSelect;
type StateRow = typeof schema.careerPlayerState.$inferSelect;

export function toSquadPlayer(p: PlayerRow, s: StateRow): SquadPlayer {
  const attrs = applyProgression(p.attributes, s.progression);
  return {
    id: p.id,
    clubId: s.clubId,
    name: p.shortName,
    firstName: p.firstName,
    lastName: p.lastName,
    shirt: p.shirtNumber,
    position: p.position,
    age: p.age + s.ageDelta,
    nationality: p.nationality,
    foot: p.foot,
    height: p.height,
    archetype: p.archetype,
    overall: computeOverall(attrs, p.position),
    potential: Math.max(p.potential, computeOverall(attrs, p.position)),
    attrs,
    traits: p.traits,
    value: p.value,
    wage: p.wage,
    condition: Math.round(s.condition),
    morale: Math.round(s.morale),
    yellowAccum: s.yellowAccum,
    suspendedRounds: s.suspendedRounds,
    injuryDays: s.injuryDays,
    available: isAvailable(s),
    appearances: s.appearances,
    goals: s.goals,
    assists: s.assists,
    yellows: s.yellows,
    reds: s.reds,
    avgRating: s.appearances ? Math.round((s.ratingSum / s.appearances) * 100) / 100 : null,
    scoutReport: p.scoutReport,
  };
}

const POS_ORDER: Position[] = ["GOL", "ZAG", "LAT", "VOL", "MC", "MEI", "PON", "ATA"];

export async function loadSquads(db: DbOrTx, careerId: string, clubIds: number[]): Promise<Map<number, SquadPlayer[]>> {
  const rows = await db
    .select({ p: schema.players, s: schema.careerPlayerState })
    .from(schema.careerPlayerState)
    .innerJoin(schema.players, eq(schema.players.id, schema.careerPlayerState.playerId))
    .where(and(eq(schema.careerPlayerState.careerId, careerId), inArray(schema.careerPlayerState.clubId, clubIds)));
  const map = new Map<number, SquadPlayer[]>();
  for (const id of clubIds) map.set(id, []);
  for (const { p, s } of rows) map.get(s.clubId)?.push(toSquadPlayer(p, s));
  for (const list of map.values())
    list.sort((a, b) => POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position) || b.overall - a.overall);
  return map;
}

export async function loadSquad(db: DbOrTx, careerId: string, clubId: number): Promise<SquadPlayer[]> {
  return (await loadSquads(db, careerId, [clubId])).get(clubId) ?? [];
}

export function toEngine(p: SquadPlayer): EnginePlayer {
  return {
    id: p.id,
    name: p.name,
    shirt: p.shirt,
    position: p.position,
    attrs: p.attrs,
    traits: p.traits,
    condition: p.condition,
    morale: p.morale,
  };
}

export interface ClubInfo {
  id: number;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  strength: number;
  defaultFormation: Tactics["formation"];
}

/** Escalação do usuário: respeita a escolha salva e completa com os melhores disponíveis. */
export function resolveUserLineup(
  squad: SquadPlayer[],
  tactics: Tactics,
  saved: { starters: number[]; bench: number[] } | null,
): { starters: EnginePlayer[]; bench: EnginePlayer[]; replaced: { outId: number; inId: number }[] } {
  const available = squad.filter((p) => p.available).map(toEngine);
  const byId = new Map(available.map((p) => [p.id, p]));
  if (!saved) {
    const auto = pickBestXI(available, tactics.formation);
    return { ...auto, replaced: [] };
  }
  const slots = FORMATION_SLOTS[tactics.formation];
  const used = new Set<number>();
  const starters: (EnginePlayer | null)[] = slots.map((_, i) => {
    const p = byId.get(saved.starters[i]);
    if (p && !used.has(p.id)) {
      used.add(p.id);
      return p;
    }
    return null;
  });
  const replaced: { outId: number; inId: number }[] = [];
  const benchPool = saved.bench.map((id) => byId.get(id)).filter((p): p is EnginePlayer => !!p);
  starters.forEach((p, i) => {
    if (p) return;
    const role = slots[i].role;
    const candidates = [...benchPool, ...available].filter((c) => !used.has(c.id));
    candidates.sort((a, b) => roleScore(b, role) - roleScore(a, role));
    const pick = candidates[0];
    if (pick) {
      used.add(pick.id);
      starters[i] = pick;
      if (saved.starters[i]) replaced.push({ outId: saved.starters[i], inId: pick.id });
    }
  });
  const bench: EnginePlayer[] = [];
  for (const p of benchPool) {
    if (used.has(p.id) || bench.length >= 9) continue;
    used.add(p.id);
    bench.push(p);
  }
  const rest = available.filter((p) => !used.has(p.id)).sort((a, b) => roleScore(b, b.position) - roleScore(a, a.position));
  if (!bench.some((p) => p.position === "GOL")) {
    const gk = rest.find((p) => p.position === "GOL");
    if (gk) {
      bench.unshift(gk);
      used.add(gk.id);
    }
  }
  for (const p of rest) if (!used.has(p.id) && bench.length < 9) bench.push(p);
  return { starters: starters.filter((p): p is EnginePlayer => !!p), bench, replaced };
}

export function aiTactics(club: ClubInfo, opponentStrength: number, seed: number): Tactics {
  const rng = new Rng(hashSeed(seed, club.id, "tac"));
  const diff = club.strength - opponentStrength;
  const style: Style = diff > 4 ? "ofensivo" : diff < -5 ? "defensivo" : rng.chance(0.25) ? rng.pick(["ofensivo", "defensivo"] as const) : "equilibrado";
  const pressing: Pressing = rng.weighted(["baixa", "media", "alta"] as const, [1, 3, diff > 0 ? 2 : 1]);
  return { formation: club.defaultFormation, style, pressing, marking: rng.chance(0.25) ? "individual" : "zona" };
}

export function buildTeam(
  club: ClubInfo,
  tactics: Tactics,
  lineup: { starters: EnginePlayer[]; bench: EnginePlayer[] },
  autoSubs: boolean,
): TeamInput {
  return {
    clubId: club.id,
    name: club.name,
    shortName: club.shortName,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    tactics,
    starters: lineup.starters,
    bench: lineup.bench,
    autoSubs,
  };
}

export function buildAiTeam(club: ClubInfo, squad: SquadPlayer[], opponentStrength: number, seed: number): TeamInput {
  const tactics = aiTactics(club, opponentStrength, seed);
  const available = squad.filter((p) => p.available).map(toEngine);
  return buildTeam(club, tactics, pickBestXI(available, tactics.formation), true);
}
