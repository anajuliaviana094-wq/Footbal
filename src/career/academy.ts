import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AppError } from "@/lib/errors";
import type { AppUser } from "@/lib/session";
import { getCareer, type CareerContext } from "./context";
import { academyUpgradeCost, MAX_ACADEMY_LEVEL } from "./economy";
import { MAX_SQUAD } from "./transfers";
import { loadSquad } from "./squad";

export async function getAcademy(ctx: CareerContext) {
  const squad = await loadSquad(getDb(), ctx.career.id, ctx.clubId);
  const youth = squad.filter((p) => p.squadRole === "youth").sort((a, b) => b.potential - a.potential);
  const firstTeam = squad.filter((p) => p.squadRole === "first").length;
  return {
    youth,
    firstTeam,
    level: ctx.cclub.academyLevel,
    upgradeCost: ctx.cclub.academyLevel < MAX_ACADEMY_LEVEL ? academyUpgradeCost(ctx.league.level, ctx.cclub.academyLevel) : null,
  };
}

async function ownYouth(ctx: CareerContext, playerId: number) {
  const [s] = await getDb()
    .select()
    .from(schema.careerPlayerState)
    .where(and(eq(schema.careerPlayerState.careerId, ctx.career.id), eq(schema.careerPlayerState.playerId, playerId)));
  if (!s || s.clubId !== ctx.clubId || s.squadRole !== "youth") throw new AppError("Jogador da base não encontrado", 404);
  return s;
}

/** Sobe um garoto da base para o elenco principal. */
export async function promoteYouth(user: AppUser, careerId: string, playerId: number) {
  const ctx = await getCareer(user, careerId);
  await ownYouth(ctx, playerId);
  const { firstTeam } = await getAcademy(ctx);
  if (firstTeam >= MAX_SQUAD) throw new AppError(`O elenco principal já tem ${MAX_SQUAD} jogadores`);
  await getDb()
    .update(schema.careerPlayerState)
    .set({ squadRole: "first" })
    .where(and(eq(schema.careerPlayerState.careerId, careerId), eq(schema.careerPlayerState.playerId, playerId)));
}

/** Dispensa um garoto da base (ele deixa o jogo). */
export async function releaseYouth(user: AppUser, careerId: string, playerId: number) {
  const ctx = await getCareer(user, careerId);
  await ownYouth(ctx, playerId);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.careerPlayerState)
      .where(and(eq(schema.careerPlayerState.careerId, careerId), eq(schema.careerPlayerState.playerId, playerId)));
    await tx.delete(schema.players).where(and(eq(schema.players.id, playerId), eq(schema.players.careerId, careerId)));
  });
}

/** Investe na estrutura da base: melhora o potencial das próximas levas. */
export async function upgradeAcademy(user: AppUser, careerId: string) {
  const ctx = await getCareer(user, careerId);
  const level = ctx.cclub.academyLevel;
  if (level >= MAX_ACADEMY_LEVEL) throw new AppError("A base já está no nível máximo");
  const cost = academyUpgradeCost(ctx.league.level, level);
  if (ctx.cclub.balance < cost) throw new AppError("Caixa insuficiente para o investimento");
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.careerClubs)
      .set({ academyLevel: level + 1, balance: sql`${schema.careerClubs.balance} - ${cost}` })
      .where(and(eq(schema.careerClubs.careerId, careerId), eq(schema.careerClubs.clubId, ctx.clubId)));
    await tx.insert(schema.clubTransactions).values({
      careerId,
      clubId: ctx.clubId,
      season: ctx.career.season,
      day: ctx.career.currentRound,
      kind: "academy",
      amount: -cost,
      description: `Investimento na base (nível ${level + 1})`,
    });
  });
}
