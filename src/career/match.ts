import "server-only";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { narrateKeyEvents } from "@/ai/narration";
import { FEED_TYPES, templateNarration } from "@/ai/templates";
import { getDb, schema } from "@/db";
import { simulateMatch } from "@/engine/simulate";
import { FORMATIONS, type Frame, type MatchChange, type MatchEvent, type MatchResult, type Side, type TeamStats } from "@/engine/types";
import { AppError } from "@/lib/errors";
import type { AppUser } from "@/lib/session";
import type { CrestSpec } from "@/seed/generate";
import { getCareer } from "./context";

type MatchRow = typeof schema.matches.$inferSelect;

export interface PayloadPlayer {
  id: number;
  name: string;
  shirt: number;
  position: string;
}

export interface PayloadTeam {
  clubId: number;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  crest: CrestSpec;
  formation: string;
  starters: PayloadPlayer[];
  bench: PayloadPlayer[];
  tactics: { formation: string; style: string; pressing: string; marking: string };
}

export interface MatchPayload {
  matchId: number;
  careerId: string;
  status: "live" | "finished";
  userSide: Side;
  home: PayloadTeam;
  away: PayloadTeam;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  frames: Frame[];
  finalTick: number;
  halftimeTick: number;
  stats: { home: TeamStats; away: TeamStats };
  ratings: Record<number, number>;
  narrations: Record<string, { text: string; source: "ai" | "template" }>;
  changes: MatchChange[];
  round: number;
}

async function loadOwnedMatch(user: AppUser, matchId: number): Promise<{ match: MatchRow; userClubId: number }> {
  const db = getDb();
  const [match] = await db.select().from(schema.matches).where(eq(schema.matches.id, matchId));
  if (!match || !match.isUserMatch || !match.snapshot) throw new AppError("Partida não encontrada", 404);
  const ctx = await getCareer(user, match.careerId);
  return { match, userClubId: ctx.clubId };
}

function recompute(match: MatchRow): MatchResult {
  return simulateMatch({ ...match.snapshot!.input, changes: match.changes, detailed: true });
}

export async function getMatchPayload(user: AppUser, matchId: number): Promise<MatchPayload> {
  const { match, userClubId } = await loadOwnedMatch(user, matchId);
  return buildPayload(match, userClubId, recompute(match));
}

async function buildPayload(match: MatchRow, userClubId: number, result: MatchResult): Promise<MatchPayload> {
  const db = getDb();
  const input = match.snapshot!.input;
  const clubRows = await db.select().from(schema.clubs).where(inArray(schema.clubs.id, [match.homeClubId, match.awayClubId]));
  const crest = (id: number) => clubRows.find((c) => c.id === id)!.crest;
  const aiRows = await db.select().from(schema.matchNarrations).where(eq(schema.matchNarrations.matchId, match.id));
  const ai = new Map(aiRows.map((r) => [r.eventKey, r.text]));

  const team = (t: typeof input.home): PayloadTeam => ({
    clubId: t.clubId,
    name: t.name,
    shortName: t.shortName,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    crest: crest(t.clubId),
    formation: t.tactics.formation,
    tactics: t.tactics,
    starters: t.starters.map((p) => ({ id: p.id, name: p.name, shirt: p.shirt, position: p.position })),
    bench: t.bench.map((p) => ({ id: p.id, name: p.name, shirt: p.shirt, position: p.position })),
  });
  const teamName = (side: Side) => (side === "home" ? input.home.name : input.away.name);
  const narrations: MatchPayload["narrations"] = {};
  const events = result.events.filter((e) => FEED_TYPES.has(e.type) || e.type === "foul" || e.type === "corner");
  const seen = new Map<string, number>();
  for (const ev of events) {
    const n = seen.get(ev.type) ?? 0;
    seen.set(ev.type, n + 1);
    const aiText = ai.get(ev.key);
    if (aiText) narrations[ev.key] = { text: aiText, source: "ai" };
    else if (FEED_TYPES.has(ev.type)) narrations[ev.key] = { text: templateNarration(ev, teamName, n), source: "template" };
  }
  return {
    matchId: match.id,
    careerId: match.careerId,
    status: match.status,
    userSide: match.homeClubId === userClubId ? "home" : "away",
    home: team(input.home),
    away: team(input.away),
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    events,
    frames: result.frames ?? [],
    finalTick: result.finalTick,
    halftimeTick: result.halftimeTick,
    stats: result.stats,
    ratings: Object.fromEntries(result.players.map((p) => [p.playerId, p.rating])),
    narrations,
    changes: match.changes,
    round: match.round,
  };
}

export const changeSchema = z.object({
  tick: z.number().int().min(1),
  subs: z.array(z.object({ outId: z.number().int(), inId: z.number().int() })).max(5).optional(),
  tactics: z
    .object({
      formation: z.enum(FORMATIONS).optional(),
      style: z.enum(["defensivo", "equilibrado", "ofensivo"]).optional(),
      pressing: z.enum(["baixa", "media", "alta"]).optional(),
      marking: z.enum(["zona", "individual"]).optional(),
    })
    .optional(),
});

/** Aplica substituições/tática a partir de um tick e re-simula o restante. */
export async function applyMatchChange(user: AppUser, matchId: number, raw: unknown): Promise<MatchPayload> {
  const parsed = changeSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Alteração inválida");
  const { match, userClubId } = await loadOwnedMatch(user, matchId);
  if (match.status !== "live") throw new AppError("A partida já terminou", 409);
  const current = recompute(match);
  const { tick, subs, tactics } = parsed.data;
  const lastTick = match.changes.at(-1)?.tick ?? 0;
  if (tick < lastTick || tick >= current.finalTick) throw new AppError("Momento inválido para alteração");
  if (!subs?.length && !tactics) throw new AppError("Nada para alterar");

  const side: Side = match.homeClubId === userClubId ? "home" : "away";
  const change: MatchChange = { tick, side, subs, tactics };
  const changes = [...match.changes, change];
  const updated: MatchRow = { ...match, changes };
  const result = simulateMatch({ ...match.snapshot!.input, changes, detailed: true });
  // valida: as substituições pedidas precisam ter acontecido
  for (const s of subs ?? []) {
    const ok = result.events.some((e) => e.type === "sub" && e.tick === tick && e.playerId === s.inId && e.otherId === s.outId);
    if (!ok) throw new AppError("Substituição inválida (jogador fora de campo, já usado ou limite de 5 trocas).");
  }
  await getDb().update(schema.matches).set({ changes }).where(eq(schema.matches.id, matchId));
  return buildPayload(updated, userClubId, result);
}

/** Narração por IA dos eventos-chave ainda não narrados. Nunca lança erro para o cliente. */
export async function narrateMatch(user: AppUser, matchId: number): Promise<Record<string, string>> {
  const { match } = await loadOwnedMatch(user, matchId);
  const db = getDb();
  const result = recompute(match);
  const existing = await db
    .select({ key: schema.matchNarrations.eventKey })
    .from(schema.matchNarrations)
    .where(eq(schema.matchNarrations.matchId, matchId));
  const lines = await narrateKeyEvents(user.id, match.snapshot!.input, result.events, new Set(existing.map((e) => e.key)));
  const rows = Object.entries(lines).map(([eventKey, text]) => ({ matchId, eventKey, text, source: "ai" as const }));
  if (rows.length) await db.insert(schema.matchNarrations).values(rows).onConflictDoNothing();
  return lines;
}
