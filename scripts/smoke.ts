// Smoke test de ponta a ponta do domínio (sem Next).
// Uso: npm run smoke  (usa DATABASE_URL)
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { and, eq } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/db";
import { createCareer, deleteCareer, getCareer, joinCareer, playRound, setReady, startNewSeason, startUserMatch } from "@/career/service";
import { applyMatchChange, getMatchPayload } from "@/career/match";
import { getCup, getStandings, getTopScorers } from "@/career/queries";
import { makeBid, quote, searchMarket, setTransferListed, listOffers, respondOffer } from "@/career/market";
import { getAcademy, promoteYouth, upgradeAcademy } from "@/career/academy";
import { getFinances } from "@/career/finance";

const fmt = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

async function main() {
  const db = getDb();
  const mk = async (name: string, plan: "free" | "premium" = "free") =>
    (await db.insert(schema.users).values({ email: `${name}-${Date.now()}@teste.local`, name, plan }).returning())[0];
  const user = await mk("Smoke", "premium");
  const t0 = Date.now();
  const clubs = await db.select().from(schema.clubs).where(eq(schema.clubs.leagueId, "pindorama-acesso"));
  const myClub = clubs.sort((a, b) => b.strength - a.strength)[0];
  const careerId = await createCareer(user, "pindorama-acesso", myClub.id);
  console.log("carreira criada em", Date.now() - t0, "ms");
  let ctx = await getCareer(user, careerId);
  console.log("calendário:", ctx.career.totalRounds, "dias; liga:", ctx.league.name, "; saldo inicial:", fmt(ctx.cclub.balance));

  // base
  const ac = await getAcademy(ctx);
  console.log("base:", ac.youth.length, "garotos; nível", ac.level, "; upgrade", ac.upgradeCost && fmt(ac.upgradeCost));
  await promoteYouth(user, careerId, ac.youth[0].id);
  await upgradeAcademy(user, careerId);

  // mercado
  ctx = await getCareer(user, careerId);
  const market = await searchMarket(ctx, { leagueId: "pindorama-acesso", maxValue: ctx.cclub.balance * 0.5 });
  const target = market[3];
  const q = await quote(ctx, target.player.id);
  const low = await makeBid(user, careerId, target.player.id, Math.round(q!.asking * 0.5), q!.wage);
  const ok = await makeBid(user, careerId, target.player.id, q!.asking, q!.wage);
  console.log("lance baixo:", low.accepted, "|", low.message, "| lance cheio:", ok.accepted, ok.message);
  const myFirst = (await searchMarket(ctx, {})).length; // garante que busca roda
  void myFirst;

  // partida ao vivo com mudança
  const matchId = await startUserMatch(user, careerId);
  let payload = await getMatchPayload(user, matchId!);
  const team = payload[payload.userSide];
  payload = await applyMatchChange(user, matchId!, { tick: payload.halftimeTick, subs: [{ outId: team.starters[10].id, inId: team.bench[4].id }], tactics: { style: "ofensivo" } });
  console.log("partida ao vivo ok:", payload.homeGoals, "x", payload.awayGoals);

  // coloca 2 jogadores à venda para receber propostas da IA
  const squadIds = (await db.select().from(schema.careerPlayerState).where(and(eq(schema.careerPlayerState.careerId, careerId), eq(schema.careerPlayerState.clubId, myClub.id)))).map((s) => s.playerId);
  await setTransferListed(user, careerId, squadIds[20], true, null);
  await setTransferListed(user, careerId, squadIds[21], true, null);

  const t1 = Date.now();
  let days = 0;
  let accepted = 0;
  for (;;) {
    ctx = await getCareer(user, careerId);
    if (ctx.career.status === "season_over") break;
    await playRound(user, careerId);
    days++;
    const offers = (await listOffers(ctx)).filter((o) => o.incoming && o.status === "pending");
    if (offers.length && accepted < 1) {
      const r = await respondOffer(user, careerId, offers[0].id, true);
      console.log("venda:", r.message);
      accepted++;
    }
  }
  console.log(`${days} dias de jogo em ${Date.now() - t1} ms (${Math.round((Date.now() - t1) / days)} ms/dia)`);
  for (const lid of ["pindorama-elite", "pindorama-acesso"]) {
    const table = await getStandings(careerId, 1, lid);
    const gpg = table.reduce((s, r) => s + r.goalsFor, 0) / (table.length * (table.length - 1));
    console.log(lid, "campeão:", table[0].club.name, table[0].points, "pts | lanterna", table.at(-1)!.points, "pts | gols/jogo", gpg.toFixed(2));
  }
  const cup = await getCup(careerId, 1, "taca-pindorama");
  console.log("copa: fases", cup.map(([s, f]) => `${s}:${f.length}`).join(" "), "| final:", cup.at(-1)![1].map((f) => `${f.home.shortName} ${f.homeGoals}x${f.awayGoals} ${f.away.shortName}${f.penalties ? ` (pên ${f.penalties})` : ""}`).join());
  const seasons = await db.select().from(schema.careerSeasons).where(eq(schema.careerSeasons.careerId, careerId));
  for (const s of seasons) console.log("  temporada:", s.competitionId, "campeão", s.championClubId, "sobem", s.promoted, "descem", s.relegated);
  const top = await getTopScorers(careerId, null, 1);
  console.log("artilheiro geral:", top[0]?.name, top[0]?.goals);
  ctx = await getCareer(user, careerId);
  const fin = await getFinances(ctx);
  console.log("finanças: saldo", fmt(fin.balance), "| folha mensal", fmt(fin.monthlyWages), "|", fin.summary.map((s) => `${s.label} ${fmt(s.amount)}`).join("; "));
  console.log("divisão para a próxima temporada:", ctx.league.name);

  // finanças da IA: saldo médio por liga
  const cc = await db.select().from(schema.careerClubs).where(eq(schema.careerClubs.careerId, careerId));
  const neg = cc.filter((c) => c.balance < 0).length;
  console.log("clubes com saldo negativo:", neg, "de", cc.length);

  await startNewSeason(user, careerId);
  ctx = await getCareer(user, careerId);
  console.log("nova temporada:", ctx.career.season, ctx.career.status, "dia", ctx.career.currentRound, "| liga:", ctx.league.name);
  const ac2 = await getAcademy(ctx);
  console.log("base temporada 2:", ac2.youth.length, "garotos");

  // ----- multiplayer -----
  const host = await mk("Host", "premium");
  const friend = await mk("Amigo", "free");
  const mpId = await createCareer(host, "pindorama-acesso", clubs[5].id, { multiplayer: true });
  const mp = await getCareer(host, mpId);
  await joinCareer(friend, mp.career.inviteCode!, clubs[6].id);
  try { await playRound(friend, mpId); } catch (e) { console.log("amigo não pode forçar:", (e as Error).message); }
  await setReady(host, mpId, true);
  const r = await setReady(friend, mpId, true);
  const mp2 = await getCareer(friend, mpId);
  console.log("multiplayer: processou com todos prontos =", r.processed, "| dia agora", mp2.career.currentRound);
  const fx = await db.select().from(schema.fixtures).where(and(eq(schema.fixtures.careerId, mpId), eq(schema.fixtures.round, 1), eq(schema.fixtures.played, true)));
  const myFx = fx.find((f) => f.homeClubId === clubs[6].id || f.awayClubId === clubs[6].id)!;
  const replay = await getMatchPayload(friend, myFx.matchId!);
  console.log("replay do amigo:", replay.frames.length, "frames,", replay.homeGoals, "x", replay.awayGoals);

  for (const [u, id] of [[user, careerId], [host, mpId]] as const) await deleteCareer(u, id);
  for (const u of [user, host, friend]) await db.delete(schema.users).where(eq(schema.users.id, u.id));
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
