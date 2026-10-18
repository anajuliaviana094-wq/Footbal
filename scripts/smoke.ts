// Smoke test de ponta a ponta do domínio (sem Next): cria usuário + carreira e joga a temporada.
// Uso: npx tsx --conditions=react-server scripts/smoke.ts
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { eq } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/db";
import { createCareer, deleteCareer, getCareer, playRound, startNewSeason, startUserMatch } from "@/career/service";
import { applyMatchChange, getMatchPayload } from "@/career/match";
import { getStandings, getTopScorers, getCards } from "@/career/queries";

async function main() {
  const db = getDb();
  const email = `smoke-${Date.now()}@teste.local`;
  const [user] = await db.insert(schema.users).values({ email, name: "Smoke" }).returning();
  const t0 = Date.now();

  try {
    await createCareer(user, "albion", 41);
    throw new Error("deveria bloquear liga premium");
  } catch (e) {
    console.log("bloqueio premium ok:", (e as Error).message);
  }
  const clubs = await db.select().from(schema.clubs).where(eq(schema.clubs.leagueId, "pindorama-acesso"));
  const careerId = await createCareer(user, "pindorama-acesso", clubs[0].id);
  console.log("carreira criada em", Date.now() - t0, "ms");

  // partida ao vivo com substituição no intervalo
  const matchId = await startUserMatch(user, careerId);
  let payload = await getMatchPayload(user, matchId);
  const side = payload.userSide;
  const team = payload[side];
  console.log("payload frames:", payload.frames.length, "eventos:", payload.events.length, "bytes:", JSON.stringify(payload).length);
  payload = await applyMatchChange(user, matchId, {
    tick: payload.halftimeTick,
    subs: [{ outId: team.starters[10].id, inId: team.bench[4].id }],
    tactics: { style: "ofensivo" },
  });
  console.log("após alteração:", payload.homeGoals, "x", payload.awayGoals, "changes:", payload.changes.length);

  let rounds = 0;
  const t1 = Date.now();
  for (;;) {
    const ctx = await getCareer(user, careerId);
    if (ctx.career.status === "season_over") break;
    await playRound(user, careerId);
    rounds++;
  }
  console.log(`${rounds} rodadas em ${Date.now() - t1} ms`);
  const table = await getStandings(careerId, 1);
  console.log("campeão:", table[0].club.name, table[0].points, "pts", "| lanterna:", table.at(-1)!.club.name, table.at(-1)!.points);
  const scorers = await getTopScorers(careerId, 3);
  console.log("artilheiros:", scorers.map((s) => `${s.name} (${s.club.shortName}) ${s.goals}`).join(", "));
  const cards = await getCards(careerId, 3);
  console.log("cartões:", cards.map((c) => `${c.name} ${c.yellows}A/${c.reds}V`).join(", "));
  const totalGoals = table.reduce((s, r) => s + r.goalsFor, 0);
  console.log("gols/jogo:", (totalGoals / (table.length * (table.length - 1))).toFixed(2));

  await startNewSeason(user, careerId);
  const ctx = await getCareer(user, careerId);
  console.log("nova temporada:", ctx.career.season, ctx.career.status, ctx.career.currentRound);

  await deleteCareer(user, careerId);
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
