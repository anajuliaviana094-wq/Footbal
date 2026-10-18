import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { SYSTEM_BY_ID } from "@/data/leagues";
import { getDb, schema } from "@/db";
import { Rng, hashSeed } from "@/engine/rng";
import { AppError } from "@/lib/errors";
import type { AppUser } from "@/lib/session";
import { getCareer } from "./context";
import { MAX_SQUAD, MIN_SQUAD } from "./transfers";
import { upsertStates } from "./matchday";
import { seasonProgression, type PlayerState } from "./rules";
import { createSeasonRows, youthIntake } from "./setup";
import { loadSquads } from "./squad";

export async function startNewSeason(user: AppUser, careerId: string) {
  const ctx = await getCareer(user, careerId);
  const { career } = ctx;
  if (career.status !== "season_over") throw new AppError("A temporada ainda não terminou");
  if (career.isMultiplayer && !ctx.isHost) throw new AppError("Só o anfitrião pode iniciar a nova temporada.", 403);
  const db = getDb();
  const season = career.season + 1;
  const system = SYSTEM_BY_ID.get(career.systemId!)!;
  const members = await db.select().from(schema.careerMembers).where(eq(schema.careerMembers.careerId, careerId));
  const human = new Set(members.map((m) => m.clubId));

  // evolução de todos os jogadores da carreira
  const stateRows = await db.select().from(schema.careerPlayerState).where(eq(schema.careerPlayerState.careerId, careerId));
  const clubIds = [...new Set(stateRows.map((s) => s.clubId))];
  const squads = await loadSquads(db, careerId, clubIds);
  const info = new Map<number, { age: number; overall: number; potential: number; value: number; position: string }>();
  for (const list of squads.values()) for (const p of list) info.set(p.id, p);
  const rng = new Rng(hashSeed(careerId, season, "evo"));
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

  // mercado da IA entre temporadas: clubes com caixa reforçam o elenco
  const cclubs = await db
    .select()
    .from(schema.careerClubs)
    .where(and(eq(schema.careerClubs.careerId, careerId), inArray(schema.careerClubs.leagueId, system.leagues)));
  const clubRows = await db.select().from(schema.clubs).where(inArray(schema.clubs.id, cclubs.map((c) => c.clubId)));
  const strength = new Map(clubRows.map((c) => [c.id, c.strength]));
  const balance = new Map(cclubs.map((c) => [c.clubId, c.balance]));
  const stateById = new Map(updated.map((s) => [s.playerId, s]));
  const squadSize = new Map<number, number>();
  for (const s of updated) if (s.squadRole !== "youth") squadSize.set(s.clubId, (squadSize.get(s.clubId) ?? 0) + 1);
  const ai = cclubs.map((c) => c.clubId).filter((id) => !human.has(id));
  const moves: { playerId: number; from: number; to: number; fee: number }[] = [];
  const mrng = new Rng(hashSeed(careerId, season, "ai-market"));
  for (let k = 0; k < 18; k++) {
    const buyer = mrng.pick(ai);
    const candidates = ai
      .filter((id) => id !== buyer && (strength.get(id) ?? 0) <= (strength.get(buyer) ?? 0) + 2 && (squadSize.get(id) ?? 0) > MIN_SQUAD + 4)
      .flatMap((id) => (squads.get(id) ?? []).filter((p) => p.squadRole === "first" && p.age <= 30));
    const affordable = candidates.filter((p) => p.value * 1.2 <= (balance.get(buyer) ?? 0) * 0.5);
    if (!affordable.length || (squadSize.get(buyer) ?? 0) >= MAX_SQUAD - 2) continue;
    const pick = affordable.sort((a, b) => b.overall - a.overall)[mrng.int(0, Math.min(4, affordable.length - 1))];
    const st = stateById.get(pick.id);
    if (!st || moves.some((m) => m.playerId === pick.id)) continue;
    const fee = Math.round((pick.value * 1.2) / 5_000) * 5_000;
    moves.push({ playerId: pick.id, from: st.clubId, to: buyer, fee });
    balance.set(buyer, (balance.get(buyer) ?? 0) - fee);
    balance.set(st.clubId, (balance.get(st.clubId) ?? 0) + fee);
    squadSize.set(buyer, (squadSize.get(buyer) ?? 0) + 1);
    squadSize.set(st.clubId, (squadSize.get(st.clubId) ?? 0) - 1);
    st.clubId = buyer;
  }
  const names = new Map(clubRows.map((c) => [c.id, c.name]));

  await db.transaction(async (tx) => {
    await upsertStates(tx, careerId, updated);
    for (const c of cclubs) {
      if (balance.get(c.clubId) !== c.balance) {
        await tx
          .update(schema.careerClubs)
          .set({ balance: balance.get(c.clubId)! })
          .where(and(eq(schema.careerClubs.careerId, careerId), eq(schema.careerClubs.clubId, c.clubId)));
      }
    }
    await createSeasonRows(tx, careerId, season, system);
    await tx
      .update(schema.careers)
      .set({ season, currentRound: 1, status: "active", updatedAt: new Date() })
      .where(eq(schema.careers.id, careerId));
    await tx.update(schema.careerMembers).set({ ready: false }).where(eq(schema.careerMembers.careerId, careerId));
    for (const m of members) await youthIntake(tx, careerId, season, m.clubId);
    const news: (typeof schema.careerNews.$inferInsert)[] = [
      { careerId, season, round: 0, kind: "season", clubId: null, text: `Começa a temporada ${season}! Os elencos envelheceram um ano — confira a evolução dos jogadores.` },
      ...moves.slice(0, 6).map((m) => ({
        careerId,
        season,
        round: 0,
        kind: "transfer",
        clubId: null,
        text: `Mercado: ${info.get(m.playerId) ? squads.get(m.from)?.find((p) => p.id === m.playerId)?.name : "jogador"} trocou o ${names.get(m.from)} pelo ${names.get(m.to)} por R$ ${m.fee.toLocaleString("pt-BR")}.`,
      })),
    ];
    await tx.insert(schema.careerNews).values(news);
  });
}
