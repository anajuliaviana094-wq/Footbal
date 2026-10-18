import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema, type DbOrTx } from "@/db";
import { FORMATION_SLOTS } from "@/engine/formations";
import { Rng, hashSeed } from "@/engine/rng";
import { ENGINE_VERSION, simulateMatch } from "@/engine/simulate";
import { DEFAULT_TACTICS, FORMATIONS, type MatchInput, type MatchResult, type Tactics } from "@/engine/types";
import { AppError } from "@/lib/errors";
import type { AppUser } from "@/lib/session";
import { doubleRoundRobin } from "./fixtures";
import {
  applyResultToStandings,
  applyRound,
  seasonProgression,
  sortStandings,
  type PlayerState,
  type StandingRow,
} from "./rules";
import { buildAiTeam, buildTeam, loadSquad, loadSquads, resolveUserLineup, type ClubInfo } from "./squad";

export const MAX_CAREERS = 3;

type CareerRow = typeof schema.careers.$inferSelect;
type LeagueRow = typeof schema.leagues.$inferSelect;
type ClubRow = typeof schema.clubs.$inferSelect;

export function canAccessLeague(user: Pick<AppUser, "plan">, league: Pick<LeagueRow, "isFree">): boolean {
  return league.isFree || user.plan === "premium";
}

export async function listLeagues(user: AppUser) {
  const db = getDb();
  const leagues = await db.select().from(schema.leagues).orderBy(asc(schema.leagues.sortOrder));
  return leagues.map((l) => ({ ...l, locked: !canAccessLeague(user, l) }));
}

export async function listCareers(user: AppUser) {
  const db = getDb();
  const rows = await db
    .select({ career: schema.careers, club: schema.clubs, league: schema.leagues })
    .from(schema.careers)
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careers.clubId))
    .innerJoin(schema.leagues, eq(schema.leagues.id, schema.careers.leagueId))
    .where(eq(schema.careers.userId, user.id))
    .orderBy(sql`${schema.careers.updatedAt} desc`);
  return rows.map((r) => ({ ...r, locked: !canAccessLeague(user, r.league) }));
}

export interface CareerContext {
  career: CareerRow;
  league: LeagueRow;
  club: ClubRow;
}

/** Carrega a carreira garantindo dono e acesso ao plano (verificação no servidor). */
export async function getCareer(user: AppUser, careerId: string): Promise<CareerContext> {
  const db = getDb();
  const [row] = await db
    .select({ career: schema.careers, league: schema.leagues, club: schema.clubs })
    .from(schema.careers)
    .innerJoin(schema.leagues, eq(schema.leagues.id, schema.careers.leagueId))
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careers.clubId))
    .where(and(eq(schema.careers.id, careerId), eq(schema.careers.userId, user.id)))
    .limit(1);
  if (!row) throw new AppError("Carreira não encontrada", 404, "not_found");
  if (!canAccessLeague(user, row.league)) throw new AppError("Esta liga é exclusiva do plano Premium", 402, "premium_required");
  return row;
}

export async function createCareer(user: AppUser, leagueId: string, clubId: number): Promise<string> {
  const db = getDb();
  const [league] = await db.select().from(schema.leagues).where(eq(schema.leagues.id, leagueId));
  if (!league) throw new AppError("Liga inválida");
  if (!canAccessLeague(user, league)) throw new AppError("Esta liga é exclusiva do plano Premium", 402, "premium_required");
  const [club] = await db.select().from(schema.clubs).where(and(eq(schema.clubs.id, clubId), eq(schema.clubs.leagueId, leagueId)));
  if (!club) throw new AppError("Clube inválido");
  const [{ n }] = await db.select({ n: count() }).from(schema.careers).where(eq(schema.careers.userId, user.id));
  if (n >= MAX_CAREERS) throw new AppError(`Você pode ter no máximo ${MAX_CAREERS} carreiras salvas.`, 409, "limit");

  const leagueClubs = await db.select({ id: schema.clubs.id }).from(schema.clubs).where(eq(schema.clubs.leagueId, leagueId));
  const clubIds = leagueClubs.map((c) => c.id);
  const leaguePlayers = await db
    .select({ id: schema.players.id, clubId: schema.players.clubId })
    .from(schema.players)
    .where(inArray(schema.players.clubId, clubIds));

  const careerId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.careers).values({
      id: careerId,
      userId: user.id,
      leagueId,
      clubId,
      totalRounds: (clubIds.length - 1) * 2,
      tactics: { ...DEFAULT_TACTICS, formation: club.defaultFormation },
    });
    for (let i = 0; i < leaguePlayers.length; i += 1000) {
      await tx.insert(schema.careerPlayerState).values(
        leaguePlayers.slice(i, i + 1000).map((p) => ({ careerId, playerId: p.id, clubId: p.clubId })),
      );
    }
    await createSeasonRows(tx, careerId, 1, clubIds);
    await tx.insert(schema.careerNews).values({
      careerId,
      season: 1,
      round: 0,
      kind: "welcome",
      text: `Bem-vindo ao comando do ${club.name}! A diretoria espera uma boa campanha na ${league.name}.`,
    });
  });
  return careerId;
}

async function createSeasonRows(tx: DbOrTx, careerId: string, season: number, clubIds: number[]) {
  const fx = doubleRoundRobin(clubIds, hashSeed(careerId, season));
  await tx.insert(schema.fixtures).values(
    fx.map((f) => ({ careerId, season, round: f.round, homeClubId: f.home, awayClubId: f.away })),
  );
  await tx.insert(schema.standings).values(clubIds.map((clubId) => ({ careerId, season, clubId })));
}

export async function deleteCareer(user: AppUser, careerId: string) {
  await getDb()
    .delete(schema.careers)
    .where(and(eq(schema.careers.id, careerId), eq(schema.careers.userId, user.id)));
}

// ---------- tática ----------

export async function saveTactics(
  user: AppUser,
  careerId: string,
  tactics: Tactics,
  lineup: { starters: number[]; bench: number[] },
) {
  const { career } = await getCareer(user, careerId);
  if (!FORMATIONS.includes(tactics.formation)) throw new AppError("Formação inválida");
  const squad = await loadSquad(getDb(), careerId, career.clubId);
  const ids = new Set(squad.map((p) => p.id));
  const starters = lineup.starters.slice(0, FORMATION_SLOTS[tactics.formation].length);
  if (starters.some((id) => !ids.has(id))) throw new AppError("Jogador inválido na escalação");
  const bench = lineup.bench.filter((id) => ids.has(id) && !starters.includes(id)).slice(0, 9);
  if (new Set(starters).size !== starters.length) throw new AppError("Jogador repetido na escalação");
  await getDb()
    .update(schema.careers)
    .set({ tactics, lineup: { starters, bench }, updatedAt: new Date() })
    .where(eq(schema.careers.id, careerId));
}

// ---------- rodada ----------

function clubInfo(c: ClubRow): ClubInfo {
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    primaryColor: c.primaryColor,
    secondaryColor: c.secondaryColor,
    strength: c.strength,
    defaultFormation: c.defaultFormation,
  };
}

export async function getUserFixture(ctx: CareerContext) {
  const { career } = ctx;
  const [fx] = await getDb()
    .select()
    .from(schema.fixtures)
    .where(
      and(
        eq(schema.fixtures.careerId, career.id),
        eq(schema.fixtures.season, career.season),
        eq(schema.fixtures.round, career.currentRound),
        sql`(${schema.fixtures.homeClubId} = ${career.clubId} or ${schema.fixtures.awayClubId} = ${career.clubId})`,
      ),
    );
  return fx ?? null;
}

/** Cria (ou retorna) a partida "ao vivo" do usuário na rodada atual. */
export async function startUserMatch(user: AppUser, careerId: string): Promise<number> {
  const ctx = await getCareer(user, careerId);
  const { career } = ctx;
  if (career.status !== "active") throw new AppError("A temporada acabou. Inicie uma nova temporada.", 409, "season_over");
  const db = getDb();
  const fx = await getUserFixture(ctx);
  if (!fx) throw new AppError("Nenhuma partida nesta rodada", 404);
  const [live] = await db
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(and(eq(schema.matches.fixtureId, fx.id), eq(schema.matches.status, "live")));
  if (live) return live.id;

  const clubsRows = await db.select().from(schema.clubs).where(inArray(schema.clubs.id, [fx.homeClubId, fx.awayClubId]));
  const home = clubInfo(clubsRows.find((c) => c.id === fx.homeClubId)!);
  const away = clubInfo(clubsRows.find((c) => c.id === fx.awayClubId)!);
  const squads = await loadSquads(db, careerId, [home.id, away.id]);
  const seed = hashSeed(careerId, career.season, career.currentRound, "user");
  const userIsHome = home.id === career.clubId;
  const userClub = userIsHome ? home : away;
  const oppClub = userIsHome ? away : home;
  const userLineup = resolveUserLineup(squads.get(userClub.id)!, career.tactics, career.lineup ?? null);
  const userTeam = buildTeam(userClub, career.tactics, userLineup, true);
  const oppTeam = buildAiTeam(oppClub, squads.get(oppClub.id)!, userClub.strength, seed);
  const input: MatchInput = {
    home: userIsHome ? userTeam : oppTeam,
    away: userIsHome ? oppTeam : userTeam,
    seed,
    detailed: true,
  };
  const [row] = await db
    .insert(schema.matches)
    .values({
      careerId,
      fixtureId: fx.id,
      season: career.season,
      round: career.currentRound,
      homeClubId: home.id,
      awayClubId: away.id,
      seed,
      isUserMatch: true,
      status: "live",
      snapshot: { input, engineVersion: ENGINE_VERSION },
      changes: [],
    })
    .returning({ id: schema.matches.id });
  return row.id;
}

const STORED_EVENT_TYPES = new Set(["goal", "yellow", "second_yellow", "red", "penalty", "penalty_miss", "injury", "sub"]);

function eventRows(matchId: number, careerId: string, result: MatchResult) {
  return result.events
    .filter((e) => STORED_EVENT_TYPES.has(e.type))
    .map((e) => ({
      matchId,
      careerId,
      eventKey: e.key,
      minute: e.minute,
      type: e.type,
      side: e.side,
      playerId: e.playerId ?? null,
      otherPlayerId: e.otherId ?? null,
      detail: e.detail ?? null,
    }));
}

/**
 * Encerra a rodada: finaliza a partida do usuário (simulando direto se ele não assistiu),
 * simula as demais em modo rápido e aplica todas as regras da carreira.
 */
export async function playRound(user: AppUser, careerId: string): Promise<{ matchId: number }> {
  const matchId = await startUserMatch(user, careerId);
  const db = getDb();

  return db.transaction(async (tx) => {
    // trava a carreira para evitar processamento duplo
    const [career] = await tx.select().from(schema.careers).where(eq(schema.careers.id, careerId)).for("update");
    const [match] = await tx.select().from(schema.matches).where(eq(schema.matches.id, matchId));
    if (!career || !match || match.status !== "live" || match.round !== career.currentRound) {
      return { matchId };
    }
    const { season, currentRound: round } = career;

    const leagueClubs = await tx.select().from(schema.clubs).where(eq(schema.clubs.leagueId, career.leagueId));
    const clubById = new Map(leagueClubs.map((c) => [c.id, c]));
    const clubIds = leagueClubs.map((c) => c.id);
    const squads = await loadSquads(tx, careerId, clubIds);

    // partida do usuário
    const userResult = simulateMatch({ ...match.snapshot!.input, changes: match.changes, detailed: false });
    const results: { fixtureId: number; home: number; away: number; result: MatchResult; matchId?: number; seed: number }[] = [
      { fixtureId: match.fixtureId, home: match.homeClubId, away: match.awayClubId, result: userResult, matchId, seed: match.seed },
    ];

    // demais partidas da rodada
    const roundFixtures = await tx
      .select()
      .from(schema.fixtures)
      .where(and(eq(schema.fixtures.careerId, careerId), eq(schema.fixtures.season, season), eq(schema.fixtures.round, round)));
    for (const fx of roundFixtures) {
      if (fx.id === match.fixtureId || fx.played) continue;
      const home = clubInfo(clubById.get(fx.homeClubId)!);
      const away = clubInfo(clubById.get(fx.awayClubId)!);
      const seed = hashSeed(careerId, season, round, fx.id);
      const result = simulateMatch({
        home: buildAiTeam(home, squads.get(home.id)!, away.strength, seed),
        away: buildAiTeam(away, squads.get(away.id)!, home.strength, seed),
        seed,
        detailed: false,
      });
      results.push({ fixtureId: fx.id, home: home.id, away: away.id, result, seed });
    }

    // persiste partidas, eventos e fixtures
    await tx
      .update(schema.matches)
      .set({
        status: "finished",
        homeGoals: userResult.homeGoals,
        awayGoals: userResult.awayGoals,
        stats: userResult.stats,
        ratings: Object.fromEntries(userResult.players.map((p) => [p.playerId, p.rating])),
      })
      .where(eq(schema.matches.id, matchId));
    const allEvents: ReturnType<typeof eventRows> = eventRows(matchId, careerId, userResult);
    for (const r of results.slice(1)) {
      const [m] = await tx
        .insert(schema.matches)
        .values({
          careerId,
          fixtureId: r.fixtureId,
          season,
          round,
          homeClubId: r.home,
          awayClubId: r.away,
          homeGoals: r.result.homeGoals,
          awayGoals: r.result.awayGoals,
          seed: r.seed,
          status: "finished",
          stats: r.result.stats,
          ratings: Object.fromEntries(r.result.players.map((p) => [p.playerId, p.rating])),
        })
        .returning({ id: schema.matches.id });
      r.matchId = m.id;
      allEvents.push(...eventRows(m.id, careerId, r.result));
    }
    if (allEvents.length) await tx.insert(schema.matchEvents).values(allEvents);
    for (const r of results) {
      await tx
        .update(schema.fixtures)
        .set({ played: true, homeGoals: r.result.homeGoals, awayGoals: r.result.awayGoals, matchId: r.matchId })
        .where(eq(schema.fixtures.id, r.fixtureId));
    }

    // classificação
    const standingRows = await tx
      .select()
      .from(schema.standings)
      .where(and(eq(schema.standings.careerId, careerId), eq(schema.standings.season, season)));
    const table = new Map<number, StandingRow>(standingRows.map((s) => [s.clubId, { ...s }]));
    const clubResults = new Map<number, "W" | "D" | "L">();
    for (const r of results) {
      applyResultToStandings(table, r.home, r.away, r.result.homeGoals, r.result.awayGoals);
      const hg = r.result.homeGoals;
      const ag = r.result.awayGoals;
      clubResults.set(r.home, hg > ag ? "W" : hg < ag ? "L" : "D");
      clubResults.set(r.away, ag > hg ? "W" : ag < hg ? "L" : "D");
    }
    await tx
      .insert(schema.standings)
      .values([...table.values()].map((s) => ({ ...s, careerId, season })))
      .onConflictDoUpdate({
        target: [schema.standings.careerId, schema.standings.season, schema.standings.clubId],
        set: {
          played: sql`excluded.played`,
          won: sql`excluded.won`,
          drawn: sql`excluded.drawn`,
          lost: sql`excluded.lost`,
          goalsFor: sql`excluded.goals_for`,
          goalsAgainst: sql`excluded.goals_against`,
          points: sql`excluded.points`,
          form: sql`excluded.form`,
        },
      });

    // estados dos jogadores
    const stateRows = await tx.select().from(schema.careerPlayerState).where(eq(schema.careerPlayerState.careerId, careerId));
    const states = new Map<number, PlayerState>(stateRows.map((s) => [s.playerId, { ...s }]));
    const resistencia = new Map<number, number>();
    const nameById = new Map<number, string>();
    for (const list of squads.values())
      for (const p of list) {
        resistencia.set(p.id, p.attrs.resistencia);
        nameById.set(p.id, p.name);
      }
    const news = applyRound(
      states,
      results.flatMap((r) => r.result.players),
      clubResults,
      resistencia,
    );
    await upsertStates(tx, careerId, [...states.values()]);

    // notícias do clube do usuário
    const userClub = clubById.get(career.clubId)!;
    const isHome = match.homeClubId === career.clubId;
    const opp = clubById.get(isHome ? match.awayClubId : match.homeClubId)!;
    const gf = isHome ? userResult.homeGoals : userResult.awayGoals;
    const ga = isHome ? userResult.awayGoals : userResult.homeGoals;
    const verb = gf > ga ? "venceu" : gf < ga ? "perdeu para" : "empatou com";
    const newsRows: (typeof schema.careerNews.$inferInsert)[] = [
      { careerId, season, round, kind: "result", text: `Rodada ${round}: ${userClub.name} ${verb} ${opp.name} por ${gf} a ${ga}.` },
    ];
    for (const n of news) {
      if (n.clubId !== career.clubId) continue;
      const name = nameById.get(n.playerId) ?? "Jogador";
      if (n.kind === "suspension") newsRows.push({ careerId, season, round, kind: "suspension", text: `${name} está suspenso por ${n.rounds} rodada(s) — ${n.text}.` });
      if (n.kind === "injury") newsRows.push({ careerId, season, round, kind: "injury", text: `${name} se lesionou e deve desfalcar o time por cerca de ${n.days} dias.` });
      if (n.kind === "recovered") newsRows.push({ careerId, season, round, kind: "recovered", text: `${name} está recuperado e à disposição.` });
    }
    const sorted = sortStandings([...table.values()]);
    const leader = clubById.get(sorted[0].clubId)!;
    newsRows.push({ careerId, season, round, kind: "table", text: `${leader.name} lidera a liga com ${sorted[0].points} pontos.` });

    // avança rodada / fim de temporada
    const nextRound = round + 1;
    const seasonOver = nextRound > career.totalRounds;
    if (seasonOver) {
      const champion = sorted[0];
      const userPos = sorted.findIndex((s) => s.clubId === career.clubId) + 1;
      const top = [...states.values()].sort((a, b) => b.goals - a.goals)[0];
      await tx.insert(schema.seasonHistory).values({
        careerId,
        season,
        championClubId: champion.clubId,
        userPosition: userPos,
        userPoints: table.get(career.clubId)!.points,
        topScorerId: top?.playerId ?? null,
        topScorerGoals: top?.goals ?? null,
      });
      newsRows.push({
        careerId,
        season,
        round,
        kind: "season",
        text:
          champion.clubId === career.clubId
            ? `É CAMPEÃO! O ${userClub.name} conquista a temporada ${season}!`
            : `Fim de temporada: ${clubById.get(champion.clubId)!.name} é o campeão. Seu time terminou em ${userPos}º.`,
      });
    }
    await tx.insert(schema.careerNews).values(newsRows);
    await tx
      .update(schema.careers)
      .set({
        currentRound: seasonOver ? round : nextRound,
        status: seasonOver ? "season_over" : "active",
        updatedAt: new Date(),
      })
      .where(eq(schema.careers.id, careerId));
    return { matchId };
  });
}

async function upsertStates(tx: DbOrTx, careerId: string, states: PlayerState[]) {
  for (let i = 0; i < states.length; i += 1000) {
    await tx
      .insert(schema.careerPlayerState)
      .values(states.slice(i, i + 1000).map((s) => ({ ...s, careerId })))
      .onConflictDoUpdate({
        target: [schema.careerPlayerState.careerId, schema.careerPlayerState.playerId],
        set: {
          clubId: sql`excluded.club_id`,
          condition: sql`excluded.condition`,
          morale: sql`excluded.morale`,
          yellowAccum: sql`excluded.yellow_accum`,
          suspendedRounds: sql`excluded.suspended_rounds`,
          injuryDays: sql`excluded.injury_days`,
          ageDelta: sql`excluded.age_delta`,
          progression: sql`excluded.progression`,
          appearances: sql`excluded.appearances`,
          goals: sql`excluded.goals`,
          assists: sql`excluded.assists`,
          yellows: sql`excluded.yellows`,
          reds: sql`excluded.reds`,
          ratingSum: sql`excluded.rating_sum`,
        },
      });
  }
}

// ---------- nova temporada ----------

export async function startNewSeason(user: AppUser, careerId: string) {
  const { career, club } = await getCareer(user, careerId);
  if (career.status !== "season_over") throw new AppError("A temporada ainda não terminou");
  const db = getDb();
  const season = career.season + 1;
  const leagueClubs = await db.select({ id: schema.clubs.id }).from(schema.clubs).where(eq(schema.clubs.leagueId, career.leagueId));
  const clubIds = leagueClubs.map((c) => c.id);
  const squads = await loadSquads(db, careerId, clubIds);
  const stateRows = await db.select().from(schema.careerPlayerState).where(eq(schema.careerPlayerState.careerId, careerId));
  const rng = new Rng(hashSeed(careerId, season, "evo"));
  const info = new Map<number, { age: number; overall: number; potential: number }>();
  for (const list of squads.values()) for (const p of list) info.set(p.id, p);

  const updated: PlayerState[] = stateRows.map((s) => {
    const p = info.get(s.playerId);
    const age = (p?.age ?? 25) + 1;
    const delta = p ? seasonProgression(age, p.overall, p.potential, () => rng.next()) : 0;
    return {
      ...s,
      ageDelta: s.ageDelta + 1,
      progression: s.progression + delta,
      condition: 100,
      morale: 60,
      yellowAccum: 0,
      suspendedRounds: 0,
      injuryDays: 0,
      appearances: 0,
      goals: 0,
      assists: 0,
      yellows: 0,
      reds: 0,
      ratingSum: 0,
    };
  });

  await db.transaction(async (tx) => {
    await upsertStates(tx, careerId, updated);
    await createSeasonRows(tx, careerId, season, clubIds);
    await tx
      .update(schema.careers)
      .set({ season, currentRound: 1, status: "active", updatedAt: new Date() })
      .where(eq(schema.careers.id, careerId));
    await tx.insert(schema.careerNews).values({
      careerId,
      season,
      round: 0,
      kind: "season",
      text: `Começa a temporada ${season}! O elenco do ${club.name} envelheceu um ano — confira a evolução dos jogadores.`,
    });
  });
}
