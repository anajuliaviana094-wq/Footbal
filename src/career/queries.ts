import "server-only";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sortStandings } from "./rules";
import { loadSquad, toSquadPlayer } from "./squad";
import type { CareerContext } from "./service";

export async function getLeagueClubs(leagueId: string) {
  return getDb().select().from(schema.clubs).where(eq(schema.clubs.leagueId, leagueId)).orderBy(schema.clubs.name);
}

export async function getStandings(careerId: string, season: number) {
  const rows = await getDb()
    .select({ s: schema.standings, club: schema.clubs })
    .from(schema.standings)
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.standings.clubId))
    .where(and(eq(schema.standings.careerId, careerId), eq(schema.standings.season, season)));
  const sorted = sortStandings(rows.map((r) => ({ ...r.s, club: r.club })));
  return sorted.map((r, i) => ({ ...r, position: i + 1 }));
}

export async function getTopScorers(careerId: string, limit = 20) {
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
    .where(and(eq(schema.careerPlayerState.careerId, careerId), gt(schema.careerPlayerState.goals, 0)))
    .orderBy(desc(schema.careerPlayerState.goals), desc(schema.careerPlayerState.assists))
    .limit(limit);
}

export async function getCards(careerId: string, limit = 20) {
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
    .where(
      and(
        eq(schema.careerPlayerState.careerId, careerId),
        or(gt(schema.careerPlayerState.yellows, 0), gt(schema.careerPlayerState.reds, 0)),
      ),
    )
    .orderBy(desc(schema.careerPlayerState.reds), desc(schema.careerPlayerState.yellows))
    .limit(limit);
}

export async function getRoundFixtures(careerId: string, season: number, round: number) {
  const db = getDb();
  const home = schema.clubs;
  const rows = await db
    .select({ f: schema.fixtures })
    .from(schema.fixtures)
    .where(and(eq(schema.fixtures.careerId, careerId), eq(schema.fixtures.season, season), eq(schema.fixtures.round, round)));
  const clubs = await db.select().from(home);
  const byId = new Map(clubs.map((c) => [c.id, c]));
  return rows.map(({ f }) => ({ ...f, home: byId.get(f.homeClubId)!, away: byId.get(f.awayClubId)! }));
}

export async function getRoundGoals(careerId: string, season: number, round: number) {
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
        eq(schema.matches.round, round),
        or(eq(schema.matchEvents.type, "goal"), eq(schema.matchEvents.type, "red"), eq(schema.matchEvents.type, "second_yellow")),
      ),
    )
    .orderBy(schema.matchEvents.minute);
}

export async function getDashboard(ctx: CareerContext) {
  const { career } = ctx;
  const db = getDb();
  const [table, news, squad, recent] = await Promise.all([
    getStandings(career.id, career.season),
    db
      .select()
      .from(schema.careerNews)
      .where(eq(schema.careerNews.careerId, career.id))
      .orderBy(desc(schema.careerNews.id))
      .limit(12),
    loadSquad(db, career.id, career.clubId),
    db
      .select()
      .from(schema.fixtures)
      .where(
        and(
          eq(schema.fixtures.careerId, career.id),
          eq(schema.fixtures.season, career.season),
          eq(schema.fixtures.played, true),
          sql`(${schema.fixtures.homeClubId} = ${career.clubId} or ${schema.fixtures.awayClubId} = ${career.clubId})`,
        ),
      )
      .orderBy(desc(schema.fixtures.round))
      .limit(5),
  ]);
  const nextFixtures = await db
    .select()
    .from(schema.fixtures)
    .where(
      and(
        eq(schema.fixtures.careerId, career.id),
        eq(schema.fixtures.season, career.season),
        eq(schema.fixtures.played, false),
        sql`(${schema.fixtures.homeClubId} = ${career.clubId} or ${schema.fixtures.awayClubId} = ${career.clubId})`,
      ),
    )
    .orderBy(schema.fixtures.round)
    .limit(3);
  const clubs = new Map(table.map((t) => [t.clubId, t]));
  const morale = squad.length ? Math.round(squad.reduce((s, p) => s + p.morale, 0) / squad.length) : 60;
  const unavailable = squad.filter((p) => !p.available);
  const hanging = squad.filter((p) => p.available && p.yellowAccum === 2);
  const [history] = await db
    .select()
    .from(schema.seasonHistory)
    .where(and(eq(schema.seasonHistory.careerId, career.id), eq(schema.seasonHistory.season, career.season)));
  return { table, clubs, news, squad, morale, unavailable, hanging, recent, nextFixtures, history: history ?? null };
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
  return getDb()
    .select({ h: schema.seasonHistory, club: schema.clubs })
    .from(schema.seasonHistory)
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.seasonHistory.championClubId))
    .where(eq(schema.seasonHistory.careerId, careerId))
    .orderBy(desc(schema.seasonHistory.season));
}
