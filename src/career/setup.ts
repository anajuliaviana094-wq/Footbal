import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { LEAGUE_BY_ID, SYSTEM_BY_ID, systemOfLeague, type LeagueSystem } from "@/data/leagues";
import { getDb, schema, type DbOrTx } from "@/db";
import type { CalendarDay } from "@/db/schema";
import { Rng, hashSeed } from "@/engine/rng";
import { DEFAULT_TACTICS, type Position } from "@/engine/types";
import { AppError } from "@/lib/errors";
import type { AppUser } from "@/lib/session";
import { generateYouthPlayer } from "@/seed/generate";
import { buildCalendar } from "./calendar";
import { canAccessLeague, countUserCareers, MAX_CAREERS } from "./context";
import { cupStageCount, firstCupStage } from "./cup";
import { careerWage, initialBalance, stadiumCapacity, wageForValue, youthQuality } from "./economy";
import { doubleRoundRobin } from "./fixtures";

function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export async function createCareer(user: AppUser, leagueId: string, clubId: number, opts: { multiplayer?: boolean } = {}): Promise<string> {
  const db = getDb();
  const [league] = await db.select().from(schema.leagues).where(eq(schema.leagues.id, leagueId));
  if (!league) throw new AppError("Liga inválida");
  if (!canAccessLeague(user, league)) throw new AppError("Esta liga é exclusiva do plano Premium", 402, "premium_required");
  const [club] = await db.select().from(schema.clubs).where(and(eq(schema.clubs.id, clubId), eq(schema.clubs.leagueId, leagueId)));
  if (!club) throw new AppError("Clube inválido");
  if ((await countUserCareers(user.id)) >= MAX_CAREERS) {
    throw new AppError(`Você pode ter no máximo ${MAX_CAREERS} carreiras salvas.`, 409, "limit");
  }

  const system = systemOfLeague(leagueId);
  const allClubs = await db.select().from(schema.clubs);
  const allLeagues = await db.select().from(schema.leagues);
  const levelOf = new Map(allLeagues.map((l) => [l.id, l.level]));
  const players = await db
    .select({ id: schema.players.id, clubId: schema.players.clubId, wage: schema.players.wage })
    .from(schema.players)
    .where(isNull(schema.players.careerId));

  const careerId = crypto.randomUUID();
  const tactics = { ...DEFAULT_TACTICS, formation: club.defaultFormation };
  await db.transaction(async (tx) => {
    await tx.insert(schema.careers).values({
      id: careerId,
      userId: user.id,
      leagueId,
      clubId,
      totalRounds: 0,
      tactics,
      version: 2,
      systemId: system.id,
      isMultiplayer: Boolean(opts.multiplayer),
      inviteCode: opts.multiplayer ? inviteCode() : null,
    });
    await tx.insert(schema.careerMembers).values({ careerId, userId: user.id, clubId, role: "host", tactics });
    // todos os clubes do mundo (para o mercado), com caixa e estádio
    await tx.insert(schema.careerClubs).values(
      allClubs.map((c) => ({
        careerId,
        clubId: c.id,
        leagueId: c.leagueId,
        balance: initialBalance(levelOf.get(c.leagueId) ?? 65, c.strength),
        capacity: stadiumCapacity(levelOf.get(c.leagueId) ?? 65, c.strength),
      })),
    );
    for (let i = 0; i < players.length; i += 1000) {
      await tx.insert(schema.careerPlayerState).values(
        players.slice(i, i + 1000).map((p) => ({ careerId, playerId: p.id, clubId: p.clubId, wage: careerWage(p.wage) })),
      );
    }
    await createSeasonRows(tx, careerId, 1, system);
    await youthIntake(tx, careerId, 1, clubId);
    await tx.insert(schema.careerNews).values({
      careerId,
      season: 1,
      round: 0,
      kind: "welcome",
      clubId,
      text: `Bem-vindo ao comando do ${club.name}! A diretoria espera uma boa campanha na ${league.name} e na ${system.cup.name}.`,
    });
  });
  return careerId;
}

/** Entra numa liga com amigos pelo código de convite, assumindo um clube livre. */
export async function joinCareer(user: AppUser, code: string, clubId: number): Promise<string> {
  const db = getDb();
  const [career] = await db
    .select()
    .from(schema.careers)
    .where(and(eq(schema.careers.inviteCode, code.trim().toUpperCase()), eq(schema.careers.isMultiplayer, true)));
  if (!career) throw new AppError("Código de convite inválido", 404);
  const [already] = await db
    .select()
    .from(schema.careerMembers)
    .where(and(eq(schema.careerMembers.careerId, career.id), eq(schema.careerMembers.userId, user.id)));
  if (already) return career.id;
  if ((await countUserCareers(user.id)) >= MAX_CAREERS) throw new AppError(`Você pode ter no máximo ${MAX_CAREERS} carreiras salvas.`, 409, "limit");
  const system = SYSTEM_BY_ID.get(career.systemId ?? "")!;
  const [cclub] = await db
    .select()
    .from(schema.careerClubs)
    .where(and(eq(schema.careerClubs.careerId, career.id), eq(schema.careerClubs.clubId, clubId)));
  if (!cclub || !system.leagues.includes(cclub.leagueId)) throw new AppError("Clube inválido para esta liga");
  const [league] = await db.select().from(schema.leagues).where(eq(schema.leagues.id, cclub.leagueId));
  if (!canAccessLeague(user, league)) throw new AppError("Este clube está numa liga exclusiva do Premium", 402, "premium_required");
  const [taken] = await db
    .select()
    .from(schema.careerMembers)
    .where(and(eq(schema.careerMembers.careerId, career.id), eq(schema.careerMembers.clubId, clubId)));
  if (taken) throw new AppError("Esse clube já tem técnico. Escolha outro.", 409);
  const [club] = await db.select().from(schema.clubs).where(eq(schema.clubs.id, clubId));
  await db.transaction(async (tx) => {
    await tx.insert(schema.careerMembers).values({
      careerId: career.id,
      userId: user.id,
      clubId,
      role: "member",
      tactics: { ...DEFAULT_TACTICS, formation: club.defaultFormation },
    });
    await youthIntake(tx, career.id, career.season, clubId);
    await tx.insert(schema.careerNews).values({
      careerId: career.id,
      season: career.season,
      round: career.currentRound,
      kind: "welcome",
      text: `${user.name ?? "Um novo técnico"} assumiu o ${club.name}.`,
      clubId: null,
    });
  });
  return career.id;
}

/** Clubes livres para quem quer entrar numa liga com amigos. */
export async function openClubs(code: string) {
  const db = getDb();
  const [career] = await db
    .select()
    .from(schema.careers)
    .where(and(eq(schema.careers.inviteCode, code.trim().toUpperCase()), eq(schema.careers.isMultiplayer, true)));
  if (!career) return null;
  const system = SYSTEM_BY_ID.get(career.systemId ?? "")!;
  const rows = await db
    .select({ cclub: schema.careerClubs, club: schema.clubs })
    .from(schema.careerClubs)
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careerClubs.clubId))
    .where(and(eq(schema.careerClubs.careerId, career.id), inArray(schema.careerClubs.leagueId, system.leagues)));
  const members = await db.select().from(schema.careerMembers).where(eq(schema.careerMembers.careerId, career.id));
  const taken = new Set(members.map((m) => m.clubId));
  const leagues = await db.select().from(schema.leagues).where(inArray(schema.leagues.id, system.leagues));
  return { career, system, leagues, clubs: rows.map((r) => ({ ...r.club, leagueId: r.cclub.leagueId, taken: taken.has(r.club.id) })) };
}

/** Calendário, jogos da liga (todas as divisões do sistema), classificação e 1ª fase da copa. */
export async function createSeasonRows(tx: DbOrTx, careerId: string, season: number, system: LeagueSystem): Promise<CalendarDay[]> {
  const cclubs = await tx
    .select({ clubId: schema.careerClubs.clubId, leagueId: schema.careerClubs.leagueId })
    .from(schema.careerClubs)
    .where(and(eq(schema.careerClubs.careerId, careerId), inArray(schema.careerClubs.leagueId, system.leagues)));
  const clubRows = await tx
    .select({ id: schema.clubs.id, strength: schema.clubs.strength })
    .from(schema.clubs)
    .where(inArray(schema.clubs.id, cclubs.map((c) => c.clubId)));
  const strength = new Map(clubRows.map((c) => [c.id, c.strength]));
  const byLeague = new Map<string, number[]>();
  for (const c of cclubs) byLeague.set(c.leagueId, [...(byLeague.get(c.leagueId) ?? []), c.clubId]);
  const leagueRounds = Math.max(...[...byLeague.values()].map((ids) => (ids.length - 1) * 2));
  const stages = cupStageCount(cclubs.length);
  const calendar = buildCalendar(leagueRounds, stages);
  const leagueDay = new Map(calendar.filter((d) => d.type === "league").map((d) => [d.round, d.day]));
  const cupDay = new Map(calendar.filter((d) => d.type === "cup").map((d) => [d.round, d.day]));

  const fixtures: (typeof schema.fixtures.$inferInsert)[] = [];
  for (const [leagueId, ids] of byLeague) {
    for (const f of doubleRoundRobin(ids, hashSeed(careerId, season, leagueId))) {
      fixtures.push({ careerId, season, round: leagueDay.get(f.round)!, stage: f.round, homeClubId: f.home, awayClubId: f.away, leagueId, competition: "league" });
    }
  }
  const sorted = [...cclubs.map((c) => c.clubId)].sort((a, b) => (strength.get(b) ?? 0) - (strength.get(a) ?? 0));
  const { pairs } = firstCupStage(sorted, hashSeed(careerId, season, "cup"));
  for (const [h, a] of pairs) {
    fixtures.push({ careerId, season, round: cupDay.get(1)!, stage: 1, homeClubId: h, awayClubId: a, leagueId: system.cup.id, competition: "cup" });
  }
  for (let i = 0; i < fixtures.length; i += 500) await tx.insert(schema.fixtures).values(fixtures.slice(i, i + 500));
  await tx.insert(schema.standings).values(cclubs.map((c) => ({ careerId, season, clubId: c.clubId, leagueId: c.leagueId })));
  await tx.update(schema.careers).set({ calendar, totalRounds: calendar.length }).where(eq(schema.careers.id, careerId));
  return calendar;
}

const YOUTH_POSITIONS: Position[] = ["GOL", "ZAG", "ZAG", "LAT", "LAT", "VOL", "MC", "MC", "MEI", "PON", "PON", "ATA", "ATA"];

/** Nova leva da base para um clube (jogadores criados só nesta carreira). */
export async function youthIntake(tx: DbOrTx, careerId: string, season: number, clubId: number): Promise<number> {
  const [cc] = await tx
    .select()
    .from(schema.careerClubs)
    .where(and(eq(schema.careerClubs.careerId, careerId), eq(schema.careerClubs.clubId, clubId)));
  const [club] = await tx.select().from(schema.clubs).where(eq(schema.clubs.id, clubId));
  const def = LEAGUE_BY_ID.get(club.leagueId)!;
  const existing = await tx
    .select({ shirt: schema.players.shirtNumber, first: schema.players.firstName, last: schema.players.lastName })
    .from(schema.careerPlayerState)
    .innerJoin(schema.players, eq(schema.players.id, schema.careerPlayerState.playerId))
    .where(and(eq(schema.careerPlayerState.careerId, careerId), eq(schema.careerPlayerState.clubId, clubId)));
  const usedShirts = new Set(existing.map((e) => e.shirt));
  const usedNames = new Set(existing.map((e) => `${e.first} ${e.last}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()));
  const rng = new Rng(hashSeed(careerId, season, clubId, "base"));
  const n = 3 + Math.floor(cc.academyLevel / 2) + rng.int(0, 1);
  const quality = youthQuality(cc.academyLevel, club.strength);
  for (let i = 0; i < n; i++) {
    const y = generateYouthPlayer(rng, { pool: def.pool, foreignPools: def.foreignPools, position: rng.pick(YOUTH_POSITIONS), quality, usedShirts, usedNames });
    const { attrs, ...rest } = y;
    const [{ id }] = await tx
      .insert(schema.players)
      .values({ ...rest, attributes: attrs, id: sql`nextval('youth_player_seq')`, clubId, careerId })
      .returning({ id: schema.players.id });
    await tx.insert(schema.careerPlayerState).values({
      careerId,
      playerId: id,
      clubId,
      squadRole: "youth",
      wage: Math.round(wageForValue(y.value) * 0.4),
      sinceSeason: season,
    });
  }
  await tx.insert(schema.careerNews).values({
    careerId,
    season,
    round: 0,
    kind: "youth",
    clubId,
    text: `${n} garotos da base do ${club.name} foram apresentados. Confira na aba Base.`,
  });
  return n;
}
