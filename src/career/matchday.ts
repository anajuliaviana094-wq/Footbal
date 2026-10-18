import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { LEAGUE_BY_ID, SYSTEM_BY_ID, type LeagueSystem } from "@/data/leagues";
import { getDb, schema, type DbOrTx } from "@/db";
import type { CalendarDay, FinanceKind } from "@/db/schema";
import { FORMATION_SLOTS } from "@/engine/formations";
import { Rng, hashSeed } from "@/engine/rng";
import { penaltyShootout } from "@/engine/shootout";
import { ENGINE_VERSION, simulateMatch } from "@/engine/simulate";
import { FORMATIONS, type MatchInput, type MatchResult, type Tactics, type TeamInput } from "@/engine/types";
import { AppError } from "@/lib/errors";
import type { AppUser } from "@/lib/session";
import { currentDay, getCareer, type CareerContext, type ClubRow } from "./context";
import { cupStageCount, nextCupStage } from "./cup";
import { cupPrize, leaguePrize, matchdayIncome } from "./economy";
import { applyResultToStandings, applyRound, sortStandings, type PlayerState, type StandingRow } from "./rules";
import { buildAiTeam, buildTeam, loadSquad, loadSquads, resolveUserLineup, type ClubInfo, type SquadPlayer } from "./squad";
import { aiInterestChance, aiOfferFee, OFFER_DAYS } from "./transfers";

export function clubInfo(c: ClubRow): ClubInfo {
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

// ---------- tática ----------

export async function saveTactics(user: AppUser, careerId: string, tactics: Tactics, lineup: { starters: number[]; bench: number[] }) {
  const ctx = await getCareer(user, careerId);
  if (!FORMATIONS.includes(tactics.formation)) throw new AppError("Formação inválida");
  const squad = (await loadSquad(getDb(), careerId, ctx.clubId)).filter((p) => p.squadRole === "first");
  const ids = new Set(squad.map((p) => p.id));
  const starters = lineup.starters.slice(0, FORMATION_SLOTS[tactics.formation].length);
  if (starters.some((id) => !ids.has(id))) throw new AppError("Jogador inválido na escalação");
  if (new Set(starters).size !== starters.length) throw new AppError("Jogador repetido na escalação");
  const bench = lineup.bench.filter((id) => ids.has(id) && !starters.includes(id)).slice(0, 9);
  await getDb()
    .update(schema.careerMembers)
    .set({ tactics, lineup: { starters, bench } })
    .where(and(eq(schema.careerMembers.careerId, careerId), eq(schema.careerMembers.userId, user.id)));
}

// ---------- jogo do dia ----------

export async function getUserFixture(ctx: Pick<CareerContext, "career" | "clubId">) {
  const { career, clubId } = ctx;
  const [fx] = await getDb()
    .select()
    .from(schema.fixtures)
    .where(
      and(
        eq(schema.fixtures.careerId, career.id),
        eq(schema.fixtures.season, career.season),
        eq(schema.fixtures.round, career.currentRound),
        sql`(${schema.fixtures.homeClubId} = ${clubId} or ${schema.fixtures.awayClubId} = ${clubId})`,
      ),
    );
  return fx ?? null;
}

type MemberRow = typeof schema.careerMembers.$inferSelect;

function humanTeam(club: ClubInfo, squad: SquadPlayer[], member: Pick<MemberRow, "tactics" | "lineup">): TeamInput {
  const lineup = resolveUserLineup(squad, member.tactics, member.lineup ?? null);
  return buildTeam(club, member.tactics, lineup, true);
}

/** Cria (ou retorna) a partida "ao vivo" do usuário no dia atual. null = o clube não joga hoje. */
export async function startUserMatch(user: AppUser, careerId: string): Promise<number | null> {
  const ctx = await getCareer(user, careerId);
  const { career } = ctx;
  if (career.status !== "active") throw new AppError("A temporada acabou. Inicie uma nova temporada.", 409, "season_over");
  if (career.isMultiplayer) throw new AppError("Na liga com amigos as partidas são processadas juntas. Marque que está pronto.", 409, "multiplayer");
  const db = getDb();
  const fx = await getUserFixture(ctx);
  if (!fx) return null;
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
  const userIsHome = home.id === ctx.clubId;
  const userClub = userIsHome ? home : away;
  const oppClub = userIsHome ? away : home;
  const userTeam = humanTeam(userClub, squads.get(userClub.id)!, ctx.member);
  const oppTeam = buildAiTeam(oppClub, squads.get(oppClub.id)!, userClub.strength, seed);
  const input: MatchInput = { home: userIsHome ? userTeam : oppTeam, away: userIsHome ? oppTeam : userTeam, seed, detailed: true };
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

/** Liga com amigos: marca/desmarca "pronto" para o dia. */
export async function setReady(user: AppUser, careerId: string, ready: boolean) {
  await getCareer(user, careerId);
  await getDb()
    .update(schema.careerMembers)
    .set({ ready })
    .where(and(eq(schema.careerMembers.careerId, careerId), eq(schema.careerMembers.userId, user.id)));
  if (ready) {
    const members = await getDb().select().from(schema.careerMembers).where(eq(schema.careerMembers.careerId, careerId));
    if (members.every((m) => m.ready)) {
      const [career] = await getDb().select().from(schema.careers).where(eq(schema.careers.id, careerId));
      await processDay(careerId, career.currentRound);
      return { processed: true };
    }
  }
  return { processed: false };
}

/**
 * Encerra o dia de jogo atual. Single player: finaliza a partida ao vivo (ou simula direto).
 * Liga com amigos: só o anfitrião pode forçar o processamento.
 */
export async function playRound(user: AppUser, careerId: string): Promise<{ matchId: number | null }> {
  const ctx = await getCareer(user, careerId);
  if (ctx.career.status !== "active") throw new AppError("A temporada acabou. Inicie uma nova temporada.", 409, "season_over");
  let matchId: number | null = null;
  if (ctx.career.isMultiplayer) {
    if (!ctx.isHost) throw new AppError("Só o anfitrião pode processar a rodada. Marque que está pronto.", 403);
  } else {
    matchId = await startUserMatch(user, careerId);
  }
  const day = ctx.career.currentRound;
  await processDay(careerId, day);
  if (!matchId) {
    const fx = await getUserFixture({ career: { ...ctx.career, currentRound: day }, clubId: ctx.clubId });
    matchId = fx?.matchId ?? null;
  }
  return { matchId };
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

type News = typeof schema.careerNews.$inferInsert;
type FixtureRow = typeof schema.fixtures.$inferSelect;

interface DayResult {
  fx: FixtureRow;
  result: MatchResult;
  input: MatchInput | null;
  seed: number;
  matchId?: number;
  winner: number | null;
  penalties: string | null;
  human: boolean;
}

/** Processa um dia de jogo inteiro numa transação. */
async function processDay(careerId: string, expectedDay: number): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [career] = await tx.select().from(schema.careers).where(eq(schema.careers.id, careerId)).for("update");
    if (!career || career.status !== "active" || career.currentRound !== expectedDay) return;
    const day = currentDay(career)!;
    const system = SYSTEM_BY_ID.get(career.systemId!)!;
    const { season } = career;

    const members = await tx.select().from(schema.careerMembers).where(eq(schema.careerMembers.careerId, careerId));
    const memberByClub = new Map(members.map((m) => [m.clubId, m]));
    const cclubs = await tx
      .select()
      .from(schema.careerClubs)
      .where(and(eq(schema.careerClubs.careerId, careerId), inArray(schema.careerClubs.leagueId, system.leagues)));
    const cclubById = new Map(cclubs.map((c) => [c.clubId, c]));
    const clubIds = cclubs.map((c) => c.clubId);
    const clubRows = await tx.select().from(schema.clubs).where(inArray(schema.clubs.id, clubIds));
    const clubById = new Map(clubRows.map((c) => [c.id, c]));
    const leagues = await tx.select().from(schema.leagues).where(inArray(schema.leagues.id, system.leagues));
    const levelOf = new Map(leagues.map((l) => [l.id, l.level]));
    const squads = await loadSquads(tx, careerId, clubIds);

    const dayFixtures = await tx
      .select()
      .from(schema.fixtures)
      .where(and(eq(schema.fixtures.careerId, careerId), eq(schema.fixtures.season, season), eq(schema.fixtures.round, day.day)));
    const liveMatches = dayFixtures.length
      ? await tx
          .select()
          .from(schema.matches)
          .where(and(inArray(schema.matches.fixtureId, dayFixtures.map((f) => f.id)), eq(schema.matches.status, "live")))
      : [];
    const liveByFixture = new Map(liveMatches.map((m) => [m.fixtureId, m]));

    // ---- simulação ----
    const results: DayResult[] = [];
    for (const fx of dayFixtures) {
      if (fx.played) continue;
      const home = clubInfo(clubById.get(fx.homeClubId)!);
      const away = clubInfo(clubById.get(fx.awayClubId)!);
      const live = liveByFixture.get(fx.id);
      let input: MatchInput;
      let seed: number;
      let result: MatchResult;
      let human = false;
      if (live?.snapshot) {
        input = live.snapshot.input;
        seed = live.seed;
        result = simulateMatch({ ...input, changes: live.changes, detailed: false });
        human = true;
      } else {
        seed = hashSeed(careerId, season, day.day, fx.id);
        const hm = memberByClub.get(home.id);
        const am = memberByClub.get(away.id);
        human = Boolean(hm || am);
        input = {
          home: hm ? humanTeam(home, squads.get(home.id)!, hm) : buildAiTeam(home, squads.get(home.id)!, away.strength, seed),
          away: am ? humanTeam(away, squads.get(away.id)!, am) : buildAiTeam(away, squads.get(away.id)!, home.strength, seed),
          seed,
          detailed: human,
        };
        result = simulateMatch({ ...input, detailed: false });
      }
      let winner: number | null = null;
      let penalties: string | null = null;
      if (result.homeGoals !== result.awayGoals) winner = result.homeGoals > result.awayGoals ? home.id : away.id;
      else if (fx.competition === "cup") {
        const sh = penaltyShootout(
          { takers: input.home.starters.slice(1), gk: input.home.starters[0] },
          { takers: input.away.starters.slice(1), gk: input.away.starters[0] },
          hashSeed(seed, "pen"),
        );
        winner = sh.home > sh.away ? home.id : away.id;
        penalties = `${sh.home}-${sh.away}`;
      }
      results.push({ fx, result, input: human ? input : null, seed, matchId: live?.id, winner, penalties, human });
    }

    // ---- partidas, eventos, jogos ----
    const allEvents: ReturnType<typeof eventRows> = [];
    for (const r of results) {
      const ratings = Object.fromEntries(r.result.players.map((p) => [p.playerId, p.rating]));
      if (r.matchId) {
        await tx
          .update(schema.matches)
          .set({ status: "finished", homeGoals: r.result.homeGoals, awayGoals: r.result.awayGoals, stats: r.result.stats, ratings })
          .where(eq(schema.matches.id, r.matchId));
      } else {
        const [m] = await tx
          .insert(schema.matches)
          .values({
            careerId,
            fixtureId: r.fx.id,
            season,
            round: day.day,
            homeClubId: r.fx.homeClubId,
            awayClubId: r.fx.awayClubId,
            homeGoals: r.result.homeGoals,
            awayGoals: r.result.awayGoals,
            seed: r.seed,
            status: "finished",
            isUserMatch: r.human,
            snapshot: r.human && r.input ? { input: { ...r.input, detailed: true }, engineVersion: ENGINE_VERSION } : null,
            stats: r.result.stats,
            ratings,
          })
          .returning({ id: schema.matches.id });
        r.matchId = m.id;
      }
      allEvents.push(...eventRows(r.matchId!, careerId, r.result));
      await tx
        .update(schema.fixtures)
        .set({
          played: true,
          homeGoals: r.result.homeGoals,
          awayGoals: r.result.awayGoals,
          matchId: r.matchId,
          winnerClubId: r.winner,
          penalties: r.penalties,
        })
        .where(eq(schema.fixtures.id, r.fx.id));
    }
    for (let i = 0; i < allEvents.length; i += 500) await tx.insert(schema.matchEvents).values(allEvents.slice(i, i + 500));

    // ---- classificação ----
    const standingRows = await tx
      .select()
      .from(schema.standings)
      .where(and(eq(schema.standings.careerId, careerId), eq(schema.standings.season, season)));
    const table = new Map<number, StandingRow & { leagueId: string | null }>(standingRows.map((s) => [s.clubId, { ...s }]));
    const clubResults = new Map<number, "W" | "D" | "L">();
    for (const r of results) {
      const { homeGoals: hg, awayGoals: ag } = r.result;
      if (r.fx.competition === "league") applyResultToStandings(table, r.fx.homeClubId, r.fx.awayClubId, hg, ag);
      const hw = r.winner === r.fx.homeClubId;
      clubResults.set(r.fx.homeClubId, hg > ag || (hg === ag && r.winner !== null && hw) ? "W" : hg < ag || (r.winner !== null && !hw) ? "L" : "D");
      clubResults.set(r.fx.awayClubId, ag > hg || (hg === ag && r.winner !== null && !hw) ? "W" : ag < hg || (r.winner !== null && hw) ? "L" : "D");
    }
    if (day.type === "league") await upsertStandings(tx, careerId, season, [...table.values()]);

    // ---- jogadores ----
    const stateRows = await tx
      .select()
      .from(schema.careerPlayerState)
      .where(and(eq(schema.careerPlayerState.careerId, careerId), inArray(schema.careerPlayerState.clubId, clubIds)));
    const states = new Map<number, PlayerState>(stateRows.map((s) => [s.playerId, { ...s }]));
    const resistencia = new Map<number, number>();
    const nameById = new Map<number, string>();
    const squadAvg = new Map<number, number>();
    for (const [cid, list] of squads) {
      const first = list.filter((p) => p.squadRole === "first");
      squadAvg.set(cid, first.reduce((s, p) => s + p.overall, 0) / Math.max(1, first.length));
      for (const p of list) {
        resistencia.set(p.id, p.attrs.resistencia);
        nameById.set(p.id, p.name);
      }
    }
    const playing = new Set(results.flatMap((r) => [r.fx.homeClubId, r.fx.awayClubId]));
    const roundNews = applyRound(states, results.flatMap((r) => r.result.players), clubResults, resistencia, playing);
    await upsertStates(tx, careerId, [...states.values()]);

    // ---- finanças ----
    const ledger: (typeof schema.clubTransactions.$inferInsert)[] = [];
    const balanceDelta = new Map<number, number>();
    const credit = (clubId: number, kind: FinanceKind, amount: number, description: string) => {
      if (!amount) return;
      balanceDelta.set(clubId, (balanceDelta.get(clubId) ?? 0) + amount);
      if (memberByClub.has(clubId)) ledger.push({ careerId, clubId, season, day: day.day, kind, amount, description });
    };
    const homeOf = new Map(results.map((r) => [r.fx.homeClubId, r.fx]));
    for (const cc of cclubs) {
      const club = clubById.get(cc.clubId)!;
      const level = levelOf.get(cc.leagueId) ?? 65;
      const st = table.get(cc.clubId);
      const form = st?.form ? [...st.form].reduce((s, c) => s + (c === "V" ? 3 : c === "E" ? 1 : 0), 0) / (3 * st.form.length) : 0.5;
      const inc = matchdayIncome({ level, strength: club.strength, capacity: cc.capacity, isHome: homeOf.has(cc.clubId), form });
      if (inc.ticket) credit(cc.clubId, "ticket", day.type === "cup" ? Math.round(inc.ticket * 1.2) : inc.ticket, day.type === "cup" ? `Bilheteria — ${system.cup.name}` : `Bilheteria — rodada ${day.round}`);
      if (day.type === "league") {
        credit(cc.clubId, "tv", inc.tv, `Cota de TV — rodada ${day.round}`);
        credit(cc.clubId, "sponsor", inc.sponsor, "Patrocínio");
        const wages = (squads.get(cc.clubId) ?? []).reduce((s, p) => s + p.wage, 0);
        credit(cc.clubId, "wages", -Math.round(wages / 4.33), "Folha salarial da semana");
      }
    }

    // ---- copa ----
    const news: News[] = [];
    const cupStages = cupStageCount(cclubs.length);
    if (day.type === "cup") {
      const winners = results.map((r) => r.winner!).filter(Boolean);
      for (const r of results) {
        const loser = r.winner === r.fx.homeClubId ? r.fx.awayClubId : r.fx.homeClubId;
        credit(loser, "prize", cupPrize(levelOf.get(cclubById.get(loser)!.leagueId) ?? 65, day.round, cupStages), `${system.cup.name}: premiação por chegar à fase ${day.round}`);
      }
      if (day.round >= cupStages) {
        const champ = winners[0];
        const final = results[0];
        credit(champ, "prize", cupPrize(levelOf.get(cclubById.get(champ)!.leagueId) ?? 65, cupStages + 1, cupStages), `${system.cup.name}: campeão!`);
        await tx.insert(schema.careerSeasons).values({
          careerId,
          season,
          competitionId: system.cup.id,
          competition: "cup",
          championClubId: champ,
          runnerUpClubId: final ? (final.winner === final.fx.homeClubId ? final.fx.awayClubId : final.fx.homeClubId) : null,
        });
        news.push({ careerId, season, round: day.day, kind: "cup", clubId: null, text: `${clubById.get(champ)!.name} é campeão da ${system.cup.name}!` });
      } else {
        let qualified = winners;
        if (day.round === 1) {
          const inFirst = new Set(dayFixtures.flatMap((f) => [f.homeClubId, f.awayClubId]));
          qualified = [...winners, ...clubIds.filter((id) => !inFirst.has(id))];
        }
        const nextDay = career.calendar!.find((d) => d.type === "cup" && d.round === day.round + 1)!;
        const pairs = nextCupStage(qualified, hashSeed(careerId, season, "cup", day.round + 1));
        await tx.insert(schema.fixtures).values(
          pairs.map(([h, a]) => ({ careerId, season, round: nextDay.day, stage: day.round + 1, homeClubId: h, awayClubId: a, leagueId: system.cup.id, competition: "cup" as const })),
        );
      }
    }

    // ---- notícias dos técnicos ----
    for (const m of members) {
      const r = results.find((x) => x.fx.homeClubId === m.clubId || x.fx.awayClubId === m.clubId);
      const me = clubById.get(m.clubId)!;
      if (r) {
        const isHome = r.fx.homeClubId === m.clubId;
        const opp = clubById.get(isHome ? r.fx.awayClubId : r.fx.homeClubId)!;
        const gf = isHome ? r.result.homeGoals : r.result.awayGoals;
        const ga = isHome ? r.result.awayGoals : r.result.homeGoals;
        const verb = gf > ga ? "venceu" : gf < ga ? "perdeu para" : "empatou com";
        const comp = r.fx.competition === "cup" ? system.cup.name : `Rodada ${day.round}`;
        let text = `${comp}: ${me.name} ${verb} ${opp.name} por ${gf} a ${ga}.`;
        if (r.penalties) text += ` Nos pênaltis (${r.penalties}), ${r.winner === m.clubId ? "classificado!" : "eliminado."}`;
        else if (r.fx.competition === "cup") text += r.winner === m.clubId ? " Classificado!" : " Eliminado.";
        news.push({ careerId, season, round: day.day, kind: "result", clubId: m.clubId, text });
      }
      for (const n of roundNews) {
        if (n.clubId !== m.clubId) continue;
        const name = nameById.get(n.playerId) ?? "Jogador";
        if (n.kind === "suspension") news.push({ careerId, season, round: day.day, kind: "suspension", clubId: m.clubId, text: `${name} está suspenso por ${n.rounds} jogo(s) — ${n.text}.` });
        if (n.kind === "injury") news.push({ careerId, season, round: day.day, kind: "injury", clubId: m.clubId, text: `${name} se lesionou e deve ficar fora por cerca de ${n.days} dias.` });
        if (n.kind === "recovered") news.push({ careerId, season, round: day.day, kind: "recovered", clubId: m.clubId, text: `${name} está recuperado e à disposição.` });
      }
    }

    // ---- mercado: ofertas vencidas e interesse da IA ----
    await tx
      .update(schema.transferOffers)
      .set({ status: "expired" })
      .where(and(eq(schema.transferOffers.careerId, careerId), eq(schema.transferOffers.status, "pending"), lt(schema.transferOffers.expiresDay, day.day)));
    const pending = await tx
      .select({ playerId: schema.transferOffers.playerId })
      .from(schema.transferOffers)
      .where(and(eq(schema.transferOffers.careerId, careerId), eq(schema.transferOffers.status, "pending")));
    const pendingIds = new Set(pending.map((p) => p.playerId));
    const rng = new Rng(hashSeed(careerId, season, day.day, "mercado"));
    const aiClubs = clubIds.filter((id) => !memberByClub.has(id));
    const offers: (typeof schema.transferOffers.$inferInsert)[] = [];
    for (const m of members) {
      const squad = (squads.get(m.clubId) ?? []).filter((p) => p.squadRole === "first");
      let made = 0;
      for (const p of squad) {
        if (made >= 2 || pendingIds.has(p.id)) continue;
        if (!rng.chance(aiInterestChance({ listed: p.transferListed, overall: p.overall, squadAvg: squadAvg.get(m.clubId) ?? 65 }))) continue;
        const fee = aiOfferFee(rng, p.value, p.transferListed, p.askingPrice);
        const buyers = aiClubs.filter((id) => {
          const bal = (cclubById.get(id)!.balance ?? 0) + (balanceDelta.get(id) ?? 0);
          return bal >= fee && clubById.get(id)!.strength >= clubById.get(m.clubId)!.strength - 8;
        });
        if (!buyers.length) continue;
        const buyer = rng.pick(buyers);
        offers.push({
          careerId,
          playerId: p.id,
          sellerClubId: m.clubId,
          buyerClubId: buyer,
          fee,
          wage: Math.round((p.wage * 1.15) / 500) * 500,
          season,
          createdDay: day.day,
          expiresDay: day.day + OFFER_DAYS,
        });
        news.push({
          careerId,
          season,
          round: day.day,
          kind: "offer",
          clubId: m.clubId,
          text: `O ${clubById.get(buyer)!.name} ofereceu R$ ${fee.toLocaleString("pt-BR")} por ${p.name}. Responda no Mercado.`,
        });
        made++;
      }
    }
    if (offers.length) await tx.insert(schema.transferOffers).values(offers);

    // ---- fim de temporada ----
    const nextDay = day.day + 1;
    const seasonOver = nextDay > career.totalRounds;
    if (seasonOver) {
      await closeSeason(tx, { careerId, season, system, cclubs, clubById, levelOf, table, states, members, credit, news });
    } else {
      const leader = sortStandings([...table.values()].filter((t) => t.leagueId === system.leagues[0]))[0];
      if (day.type === "league" && leader) {
        news.push({ careerId, season, round: day.day, kind: "table", clubId: null, text: `${clubById.get(leader.clubId)!.name} lidera a ${LEAGUE_BY_ID.get(system.leagues[0])!.name} com ${leader.points} pontos.` });
      }
    }

    // grava finanças (e a divisão de cada clube, que muda no fim da temporada)
    {
      await tx
        .insert(schema.careerClubs)
        .values(cclubs.map((c) => ({ ...c, balance: c.balance + (balanceDelta.get(c.clubId) ?? 0) })))
        .onConflictDoUpdate({
          target: [schema.careerClubs.careerId, schema.careerClubs.clubId],
          set: { balance: sql`excluded.balance`, leagueId: sql`excluded.league_id` },
        });
    }
    if (ledger.length) await tx.insert(schema.clubTransactions).values(ledger);
    if (news.length) await tx.insert(schema.careerNews).values(news);

    await tx
      .update(schema.careers)
      .set({ currentRound: seasonOver ? day.day : nextDay, status: seasonOver ? "season_over" : "active", updatedAt: new Date() })
      .where(eq(schema.careers.id, careerId));
    await tx.update(schema.careerMembers).set({ ready: false }).where(eq(schema.careerMembers.careerId, careerId));
  });
}

type CareerClub = typeof schema.careerClubs.$inferSelect;

/** Campeões, artilheiros, premiação por posição e acesso/rebaixamento entre divisões. */
async function closeSeason(
  tx: DbOrTx,
  c: {
    careerId: string;
    season: number;
    system: LeagueSystem;
    cclubs: CareerClub[];
    clubById: Map<number, ClubRow>;
    levelOf: Map<string, number>;
    table: Map<number, StandingRow & { leagueId: string | null }>;
    states: Map<number, PlayerState>;
    members: MemberRow[];
    credit: (clubId: number, kind: FinanceKind, amount: number, description: string) => void;
    news: News[];
  },
) {
  const { careerId, season, system, cclubs, clubById, levelOf, table, states, members, credit, news } = c;
  const sortedByLeague = new Map<string, (StandingRow & { leagueId: string | null })[]>();
  for (const lid of system.leagues) sortedByLeague.set(lid, sortStandings([...table.values()].filter((t) => t.leagueId === lid)));

  for (const lid of system.leagues) {
    const rows = sortedByLeague.get(lid)!;
    const level = levelOf.get(lid) ?? 65;
    rows.forEach((r, i) => credit(r.clubId, "prize", leaguePrize(level, i + 1, rows.length), `Premiação: ${i + 1}º lugar na ${LEAGUE_BY_ID.get(lid)!.name}`));
    const ids = new Set(rows.map((r) => r.clubId));
    const top = [...states.values()].filter((s) => ids.has(s.clubId)).sort((a, b) => b.goals - a.goals)[0];
    const idx = system.leagues.indexOf(lid);
    const spots = system.promotionSpots;
    const promoted = idx > 0 && spots ? rows.slice(0, spots).map((r) => r.clubId) : [];
    const relegated = idx < system.leagues.length - 1 && spots ? rows.slice(-spots).map((r) => r.clubId) : [];
    await tx.insert(schema.careerSeasons).values({
      careerId,
      season,
      competitionId: lid,
      competition: "league",
      championClubId: rows[0].clubId,
      runnerUpClubId: rows[1]?.clubId ?? null,
      topScorerId: top?.playerId ?? null,
      topScorerGoals: top?.goals ?? null,
      promoted,
      relegated,
    });
    news.push({ careerId, season, round: 0, kind: "season", clubId: null, text: `${clubById.get(rows[0].clubId)!.name} é o campeão da ${LEAGUE_BY_ID.get(lid)!.name}!` });
    // move clubes entre divisões
    for (const id of relegated) {
      const cc = cclubs.find((x) => x.clubId === id)!;
      cc.leagueId = system.leagues[idx + 1];
    }
    for (const id of promoted) {
      const cc = cclubs.find((x) => x.clubId === id)!;
      cc.leagueId = system.leagues[idx - 1];
    }
  }
  for (const m of members) {
    const row = table.get(m.clubId);
    const lid = row?.leagueId ?? "";
    const rows = sortedByLeague.get(lid) ?? [];
    const pos = rows.findIndex((r) => r.clubId === m.clubId) + 1;
    const name = clubById.get(m.clubId)!.name;
    const cc = cclubs.find((x) => x.clubId === m.clubId)!;
    let text = `Fim da temporada ${season}: ${name} terminou em ${pos}º lugar.`;
    if (pos === 1) text = `É CAMPEÃO! O ${name} conquista a ${LEAGUE_BY_ID.get(lid)!.name}!`;
    if (cc.leagueId !== lid) text += system.leagues.indexOf(cc.leagueId) < system.leagues.indexOf(lid) ? " 🎉 ACESSO CONQUISTADO!" : " 😞 Rebaixado.";
    news.push({ careerId, season, round: 0, kind: "season", clubId: m.clubId, text });
  }
}

async function upsertStandings(tx: DbOrTx, careerId: string, season: number, rows: (StandingRow & { leagueId: string | null })[]) {
  await tx
    .insert(schema.standings)
    .values(rows.map((s) => ({ ...s, careerId, season })))
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
}

export async function upsertStates(tx: DbOrTx, careerId: string, states: PlayerState[]) {
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

export type { CalendarDay };
