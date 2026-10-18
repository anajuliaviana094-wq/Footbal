import "server-only";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sortStandings } from "./rules";
import { loadSquad, toSquadPlayer } from "./squad";
import type { CareerContext } from "./context";

export async function getStandings(careerId: string, season: number, leagueId: string) {
  const rows = await getDb()
    .select({ s: schema.standings, club: schema.clubs })
    .from(schema.standings)
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.standings.clubId))
    .where(and(eq(schema.standings.careerId, careerId), eq(schema.standings.season, season), eq(schema.standings.leagueId, leagueId)));
  const sorted = sortStandings(rows.map((r) => ({ ...r.s, club: r.club })));
  return sorted.map((r, i) => ({ ...r, position: i + 1 }));
}

function statsQuery(careerId: string, leagueId: string | null) {
  const conds = [eq(schema.careerPlayerState.careerId, careerId)];
  if (leagueId) conds.push(eq(schema.careerClubs.leagueId, leagueId));
  return conds;
}

export async function getTopScorers(careerId: string, leagueId: string | null, limit = 20) {
  return getDb()
    .select({
      playerId: schema.players.id,
      name: schema.players.shortName,
      position: schema.players.position,
      goals: schema.careerPlayerState.goals,
      assists: schema.careerPlayerState.assists,
      appearances: schema.careerPlayerState.appearances,
      club: schema.clubs,
    })
    .from(schema.careerPlayerState)
    .innerJoin(schema.players, eq(schema.players.id, schema.careerPlayerState.playerId))
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careerPlayerState.clubId))
    .innerJoin(
      schema.careerClubs,
      and(eq(schema.careerClubs.careerId, schema.careerPlayerState.careerId), eq(schema.careerClubs.clubId, schema.careerPlayerState.clubId)),
    )
    .where(and(...statsQuery(careerId, leagueId), gt(schema.careerPlayerState.goals, 0)))
    .orderBy(desc(schema.careerPlayerState.goals), desc(schema.careerPlayerState.assists))
    .limit(limit);
}

export async function getCards(careerId: string, leagueId: string | null, limit = 20) {
  return getDb()
    .select({
      playerId: schema.players.id,
      name: schema.players.shortName,
      position: schema.players.position,
      yellows: schema.careerPlayerState.yellows,
      reds: schema.careerPlayerState.reds,
      suspended: schema.careerPlayerState.suspendedRounds,
      club: schema.clubs,
    })
    .from(schema.careerPlayerState)
    .innerJoin(schema.players, eq(schema.players.id, schema.careerPlayerState.playerId))
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careerPlayerState.clubId))
    .innerJoin(
      schema.careerClubs,
      and(eq(schema.careerClubs.careerId, schema.careerPlayerState.careerId), eq(schema.careerClubs.clubId, schema.careerPlayerState.clubId)),
    )
    .where(and(...statsQuery(careerId, leagueId), or(gt(schema.careerPlayerState.yellows, 0), gt(schema.careerPlayerState.reds, 0))))
    .orderBy(desc(schema.careerPlayerState.reds), desc(schema.careerPlayerState.yellows))
    .limit(limit);
}

async function withClubs<T extends { homeClubId: number; awayClubId: number }>(rows: T[]) {
  if (!rows.length) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.homeClubId, r.awayClubId]))];
  const clubs = await getDb().select().from(schema.clubs).where(inArray(schema.clubs.id, ids));
  const byId = new Map(clubs.map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, home: byId.get(r.homeClubId)!, away: byId.get(r.awayClubId)! }));
}

/** Jogos de um dia de jogo (liga ou copa); `leagueId` filtra por divisão/copa. */
export async function getDayFixtures(careerId: string, season: number, day: number, leagueId?: string) {
  const conds = [eq(schema.fixtures.careerId, careerId), eq(schema.fixtures.season, season), eq(schema.fixtures.round, day)];
  if (leagueId) conds.push(eq(schema.fixtures.leagueId, leagueId));
  return withClubs(await getDb().select().from(schema.fixtures).where(and(...conds)));
}

export async function getDayEvents(careerId: string, season: number, day: number) {
  return getDb()
    .select({
      matchId: schema.matchEvents.matchId,
      minute: schema.matchEvents.minute,
      side: schema.matchEvents.side,
      type: schema.matchEvents.type,
      name: schema.players.shortName,
    })
    .from(schema.matchEvents)
    .innerJoin(schema.matches, eq(schema.matches.id, schema.matchEvents.matchId))
    .innerJoin(schema.players, eq(schema.players.id, schema.matchEvents.playerId))
    .where(
      and(
        eq(schema.matchEvents.careerId, careerId),
        eq(schema.matches.season, season),
        eq(schema.matches.round, day),
        or(eq(schema.matchEvents.type, "goal"), eq(schema.matchEvents.type, "red"), eq(schema.matchEvents.type, "second_yellow")),
      ),
    )
    .orderBy(schema.matchEvents.minute);
}

export async function getCup(careerId: string, season: number, cupId: string) {
  const rows = await withClubs(
    await getDb()
      .select()
      .from(schema.fixtures)
      .where(and(eq(schema.fixtures.careerId, careerId), eq(schema.fixtures.season, season), eq(schema.fixtures.leagueId, cupId)))
      .orderBy(schema.fixtures.stage, schema.fixtures.id),
  );
  const stages = new Map<number, typeof rows>();
  for (const r of rows) stages.set(r.stage ?? 1, [...(stages.get(r.stage ?? 1) ?? []), r]);
  return [...stages.entries()].sort((a, b) => a[0] - b[0]);
}

function userFixtureCond(ctx: CareerContext) {
  return sql`(${schema.fixtures.homeClubId} = ${ctx.clubId} or ${schema.fixtures.awayClubId} = ${ctx.clubId})`;
}

export async function getDashboard(ctx: CareerContext) {
  const { career } = ctx;
  const db = getDb();
  const [table, news, squad, recentRaw, nextRaw, offers] = await Promise.all([
    getStandings(career.id, career.season, ctx.league.id),
    db
      .select()
      .from(schema.careerNews)
      .where(and(eq(schema.careerNews.careerId, career.id), or(isNull(schema.careerNews.clubId), eq(schema.careerNews.clubId, ctx.clubId))))
      .orderBy(desc(schema.careerNews.id))
      .limit(14),
    loadSquad(db, career.id, ctx.clubId),
    db
      .select()
      .from(schema.fixtures)
      .where(and(eq(schema.fixtures.careerId, career.id), eq(schema.fixtures.season, career.season), eq(schema.fixtures.played, true), userFixtureCond(ctx)))
      .orderBy(desc(schema.fixtures.round))
      .limit(5),
    db
      .select()
      .from(schema.fixtures)
      .where(and(eq(schema.fixtures.careerId, career.id), eq(schema.fixtures.season, career.season), eq(schema.fixtures.played, false), userFixtureCond(ctx)))
      .orderBy(schema.fixtures.round)
      .limit(3),
    db
      .select({ id: schema.transferOffers.id })
      .from(schema.transferOffers)
      .where(
        and(
          eq(schema.transferOffers.careerId, career.id),
          eq(schema.transferOffers.status, "pending"),
          eq(schema.transferOffers.sellerClubId, ctx.clubId),
        ),
      ),
  ]);
  const first = squad.filter((p) => p.squadRole === "first");
  const [recent, nextFixtures] = await Promise.all([withClubs(recentRaw), withClubs(nextRaw)]);
  const positions = new Map(table.map((t) => [t.clubId, t.position]));
  const morale = first.length ? Math.round(first.reduce((s, p) => s + p.morale, 0) / first.length) : 60;
  return {
    table,
    positions,
    news,
    squad: first,
    youthCount: squad.length - first.length,
    morale,
    unavailable: first.filter((p) => !p.available),
    hanging: first.filter((p) => p.available && p.yellowAccum === 2),
    recent,
    nextFixtures,
    pendingOffers: offers.length,
  };
}

export async function getPlayerProfile(careerId: string, playerId: number) {
  const db = getDb();
  const [row] = await db
    .select({ p: schema.players, s: schema.careerPlayerState, club: schema.clubs })
    .from(schema.careerPlayerState)
    .innerJoin(schema.players, eq(schema.players.id, schema.careerPlayerState.playerId))
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careerPlayerState.clubId))
    .where(and(eq(schema.careerPlayerState.careerId, careerId), eq(schema.careerPlayerState.playerId, playerId)));
  if (!row) return null;
  return { player: toSquadPlayer(row.p, row.s), club: row.club };
}

export async function getSeasonHistory(careerId: string) {
  const rows = await getDb()
    .select({ h: schema.careerSeasons, club: schema.clubs })
    .from(schema.careerSeasons)
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careerSeasons.championClubId))
    .where(eq(schema.careerSeasons.careerId, careerId))
    .orderBy(desc(schema.careerSeasons.season), schema.careerSeasons.competition);
  const ids = [...new Set(rows.flatMap((r) => [...(r.h.promoted ?? []), ...(r.h.relegated ?? [])]))];
  const clubs = ids.length ? await getDb().select().from(schema.clubs).where(inArray(schema.clubs.id, ids)) : [];
  const name = new Map(clubs.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    ...r,
    promoted: (r.h.promoted ?? []).map((id) => name.get(id) ?? "?"),
    relegated: (r.h.relegated ?? []).map((id) => name.get(id) ?? "?"),
  }));
}

/** Último jogo disputado pelo clube na temporada (para o painel da liga com amigos). */
export async function getLastResult(careerId: string, season: number, clubId: number) {
  const rows = await getDb()
    .select()
    .from(schema.fixtures)
    .where(
      and(
        eq(schema.fixtures.careerId, careerId),
        eq(schema.fixtures.season, season),
        eq(schema.fixtures.played, true),
        sql`(${schema.fixtures.homeClubId} = ${clubId} or ${schema.fixtures.awayClubId} = ${clubId})`,
      ),
    )
    .orderBy(desc(schema.fixtures.round))
    .limit(1);
  const [f] = await withClubs(rows);
  if (!f) return null;
  return {
    day: f.round,
    matchId: f.matchId,
    text: `${f.home.shortName} ${f.homeGoals} x ${f.awayGoals} ${f.away.shortName}${f.penalties ? ` (pên. ${f.penalties})` : ""}`,
  };
}
