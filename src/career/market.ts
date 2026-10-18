import "server-only";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema, type DbOrTx } from "@/db";
import type { Position } from "@/engine/types";
import { AppError } from "@/lib/errors";
import type { AppUser } from "@/lib/session";
import { getCareer, type CareerContext } from "./context";
import { aiAskingPrice, evaluateBid, MAX_SQUAD, MIN_SQUAD, OFFER_DAYS } from "./transfers";
import { loadSquad, toSquadPlayer } from "./squad";

export interface MarketFilters {
  position?: Position | "";
  leagueId?: string;
  maxValue?: number;
  minOverall?: number;
  maxAge?: number;
  name?: string;
  onlyListed?: boolean;
}

/** Jogadores de outros clubes à venda (todos os clubes do mundo da carreira). */
export async function searchMarket(ctx: CareerContext, f: MarketFilters) {
  const db = getDb();
  const conds = [
    eq(schema.careerPlayerState.careerId, ctx.career.id),
    sql`${schema.careerPlayerState.clubId} <> ${ctx.clubId}`,
    eq(schema.careerPlayerState.squadRole, "first"),
    or(isNull(schema.players.careerId), eq(schema.players.careerId, ctx.career.id)),
  ];
  if (f.position) conds.push(eq(schema.players.position, f.position));
  if (f.leagueId) conds.push(eq(schema.careerClubs.leagueId, f.leagueId));
  if (f.onlyListed) conds.push(eq(schema.careerPlayerState.transferListed, true));
  if (f.name) conds.push(sql`(${schema.players.firstName} || ' ' || ${schema.players.lastName}) ilike ${"%" + f.name.replace(/[%_]/g, "") + "%"}`);
  const rows = await db
    .select({ p: schema.players, s: schema.careerPlayerState, club: schema.clubs, cclub: schema.careerClubs })
    .from(schema.careerPlayerState)
    .innerJoin(schema.players, eq(schema.players.id, schema.careerPlayerState.playerId))
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careerPlayerState.clubId))
    .innerJoin(
      schema.careerClubs,
      and(eq(schema.careerClubs.careerId, schema.careerPlayerState.careerId), eq(schema.careerClubs.clubId, schema.careerPlayerState.clubId)),
    )
    .where(and(...conds))
    .orderBy(desc(sql`${schema.players.overall} + ${schema.careerPlayerState.progression}`))
    .limit(400);
  const list = rows
    .map((r) => ({ player: toSquadPlayer(r.p, r.s), club: r.club, leagueId: r.cclub.leagueId }))
    .filter((r) => (!f.maxValue || r.player.value <= f.maxValue) && (!f.minOverall || r.player.overall >= f.minOverall) && (!f.maxAge || r.player.age <= f.maxAge));
  return list.slice(0, 60);
}

async function clubSquadInfo(db: DbOrTx, careerId: string, clubId: number) {
  const squad = (await loadSquad(db, careerId, clubId)).filter((p) => p.squadRole === "first");
  const sorted = [...squad].sort((a, b) => b.overall - a.overall);
  const keyIds = new Set(sorted.slice(0, 11).map((p) => p.id));
  return { squad, keyIds };
}

/** Proposta por um jogador. IA responde na hora; outro técnico humano recebe uma oferta pendente. */
export async function makeBid(user: AppUser, careerId: string, playerId: number, fee: number, wage: number) {
  const ctx = await getCareer(user, careerId);
  const db = getDb();
  if (!Number.isFinite(fee) || fee <= 0 || !Number.isFinite(wage) || wage <= 0) throw new AppError("Valores inválidos");
  const [row] = await db
    .select({ p: schema.players, s: schema.careerPlayerState })
    .from(schema.careerPlayerState)
    .innerJoin(schema.players, eq(schema.players.id, schema.careerPlayerState.playerId))
    .where(and(eq(schema.careerPlayerState.careerId, careerId), eq(schema.careerPlayerState.playerId, playerId)));
  if (!row) throw new AppError("Jogador não encontrado", 404);
  const player = toSquadPlayer(row.p, row.s);
  const sellerId = row.s.clubId;
  if (sellerId === ctx.clubId) throw new AppError("Esse jogador já é do seu clube");
  if (player.squadRole !== "first") throw new AppError("Jogadores da base não estão à venda");
  if (ctx.cclub.balance < fee) throw new AppError("Seu clube não tem caixa para essa proposta");
  const mine = await clubSquadInfo(db, careerId, ctx.clubId);
  if (mine.squad.length >= MAX_SQUAD) throw new AppError(`O elenco já tem o máximo de ${MAX_SQUAD} jogadores`);

  const [human] = await db
    .select()
    .from(schema.careerMembers)
    .where(and(eq(schema.careerMembers.careerId, careerId), eq(schema.careerMembers.clubId, sellerId)));
  const day = ctx.career.currentRound;
  if (human) {
    await db.insert(schema.transferOffers).values({
      careerId,
      playerId,
      sellerClubId: sellerId,
      buyerClubId: ctx.clubId,
      fee,
      wage,
      season: ctx.career.season,
      createdDay: day,
      expiresDay: day + OFFER_DAYS,
    });
    await db.insert(schema.careerNews).values({
      careerId,
      season: ctx.career.season,
      round: day,
      kind: "offer",
      clubId: sellerId,
      text: `${ctx.club.name} ofereceu R$ ${fee.toLocaleString("pt-BR")} por ${player.name}. Responda no Mercado.`,
    });
    return { accepted: false, pending: true, message: "Proposta enviada ao outro técnico. Ele tem 2 dias de jogo para responder." };
  }

  const seller = await clubSquadInfo(db, careerId, sellerId);
  const [sellerClub] = await db.select().from(schema.clubs).where(eq(schema.clubs.id, sellerId));
  const [sellerCc] = await db
    .select()
    .from(schema.careerClubs)
    .where(and(eq(schema.careerClubs.careerId, careerId), eq(schema.careerClubs.clubId, sellerId)));
  const result = evaluateBid({
    fee,
    wage,
    value: player.value,
    currentWage: player.wage,
    isKeyPlayer: seller.keyIds.has(playerId),
    sellerSquadSize: seller.squad.length,
    samePositionCount: seller.squad.filter((p) => p.position === player.position).length,
    sellerRich: sellerCc.balance > player.value * 4,
    buyerStrength: ctx.club.strength,
    sellerStrength: sellerClub.strength,
  });
  if (!result.accepted) return { accepted: false, pending: false, message: result.message, counterFee: "counterFee" in result ? result.counterFee : undefined };
  await db.transaction(async (tx) => {
    await executeTransfer(tx, { careerId, season: ctx.career.season, day, playerId, playerName: player.name, sellerId, buyerId: ctx.clubId, fee, wage });
  });
  return { accepted: true, pending: false, message: result.message };
}

/** Preço pedido pela IA (mostrado antes de propor). */
export async function quote(ctx: CareerContext, playerId: number) {
  const db = getDb();
  const [row] = await db
    .select({ p: schema.players, s: schema.careerPlayerState })
    .from(schema.careerPlayerState)
    .innerJoin(schema.players, eq(schema.players.id, schema.careerPlayerState.playerId))
    .where(and(eq(schema.careerPlayerState.careerId, ctx.career.id), eq(schema.careerPlayerState.playerId, playerId)));
  if (!row) return null;
  const player = toSquadPlayer(row.p, row.s);
  const seller = await clubSquadInfo(db, ctx.career.id, row.s.clubId);
  const [cc] = await db
    .select()
    .from(schema.careerClubs)
    .where(and(eq(schema.careerClubs.careerId, ctx.career.id), eq(schema.careerClubs.clubId, row.s.clubId)));
  const scarce = seller.squad.filter((p) => p.position === player.position).length <= 2;
  const asking = aiAskingPrice(player.value, seller.keyIds.has(playerId), cc.balance > player.value * 4, scarce);
  return { asking: player.transferListed && player.askingPrice ? Math.min(player.askingPrice, asking) : asking, wage: Math.round((player.wage * 1.2) / 500) * 500 };
}

/** Aceitar/recusar proposta recebida por um jogador do seu clube. */
export async function respondOffer(user: AppUser, careerId: string, offerId: number, accept: boolean) {
  const ctx = await getCareer(user, careerId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [offer] = await tx
      .select()
      .from(schema.transferOffers)
      .where(and(eq(schema.transferOffers.id, offerId), eq(schema.transferOffers.careerId, careerId)))
      .for("update");
    if (!offer || offer.status !== "pending" || offer.sellerClubId !== ctx.clubId) throw new AppError("Proposta não está mais disponível", 409);
    if (!accept) {
      await tx.update(schema.transferOffers).set({ status: "rejected" }).where(eq(schema.transferOffers.id, offerId));
      return { message: "Proposta recusada." };
    }
    const mine = await clubSquadInfo(tx, careerId, ctx.clubId);
    if (mine.squad.length <= MIN_SQUAD) throw new AppError(`O elenco não pode ficar com menos de ${MIN_SQUAD} jogadores`);
    const [state] = await tx
      .select()
      .from(schema.careerPlayerState)
      .where(and(eq(schema.careerPlayerState.careerId, careerId), eq(schema.careerPlayerState.playerId, offer.playerId)));
    if (!state || state.clubId !== ctx.clubId) throw new AppError("O jogador não está mais no seu clube", 409);
    const [buyer] = await tx
      .select()
      .from(schema.careerClubs)
      .where(and(eq(schema.careerClubs.careerId, careerId), eq(schema.careerClubs.clubId, offer.buyerClubId)));
    if (buyer.balance < offer.fee) throw new AppError("O clube comprador não tem mais caixa para essa proposta", 409);
    const [p] = await tx.select({ name: schema.players.shortName }).from(schema.players).where(eq(schema.players.id, offer.playerId));
    await executeTransfer(tx, {
      careerId,
      season: ctx.career.season,
      day: ctx.career.currentRound,
      playerId: offer.playerId,
      playerName: p.name,
      sellerId: ctx.clubId,
      buyerId: offer.buyerClubId,
      fee: offer.fee,
      wage: offer.wage,
    });
    await tx.update(schema.transferOffers).set({ status: "accepted" }).where(eq(schema.transferOffers.id, offerId));
    return { message: `${p.name} foi vendido por R$ ${offer.fee.toLocaleString("pt-BR")}.` };
  });
}

/** Coloca/retira um jogador da lista de transferências, com preço pedido. */
export async function setTransferListed(user: AppUser, careerId: string, playerId: number, listed: boolean, askingPrice: number | null) {
  const ctx = await getCareer(user, careerId);
  await getDb()
    .update(schema.careerPlayerState)
    .set({ transferListed: listed, askingPrice: listed ? askingPrice : null })
    .where(
      and(
        eq(schema.careerPlayerState.careerId, careerId),
        eq(schema.careerPlayerState.playerId, playerId),
        eq(schema.careerPlayerState.clubId, ctx.clubId),
      ),
    );
}

export async function listOffers(ctx: CareerContext) {
  const db = getDb();
  const offers = await db
    .select()
    .from(schema.transferOffers)
    .where(
      and(
        eq(schema.transferOffers.careerId, ctx.career.id),
        or(eq(schema.transferOffers.sellerClubId, ctx.clubId), eq(schema.transferOffers.buyerClubId, ctx.clubId)),
      ),
    )
    .orderBy(desc(schema.transferOffers.id))
    .limit(40);
  if (!offers.length) return [];
  const clubIds = [...new Set(offers.flatMap((o) => [o.sellerClubId, o.buyerClubId]))];
  const playerIds = [...new Set(offers.map((o) => o.playerId))];
  const clubs = await db.select().from(schema.clubs).where(inArray(schema.clubs.id, clubIds));
  const players = await db.select().from(schema.players).where(inArray(schema.players.id, playerIds));
  const cb = new Map(clubs.map((c) => [c.id, c]));
  const pb = new Map(players.map((p) => [p.id, p]));
  return offers.map((o) => ({ ...o, seller: cb.get(o.sellerClubId)!, buyer: cb.get(o.buyerClubId)!, player: pb.get(o.playerId)!, incoming: o.sellerClubId === ctx.clubId }));
}

/** Move o jogador, ajusta caixa dos dois clubes, registra no extrato e nas notícias. */
export async function executeTransfer(
  tx: DbOrTx,
  t: { careerId: string; season: number; day: number; playerId: number; playerName: string; sellerId: number; buyerId: number; fee: number; wage: number },
) {
  await tx
    .update(schema.careerPlayerState)
    .set({ clubId: t.buyerId, wage: t.wage, transferListed: false, askingPrice: null, sinceSeason: t.season, squadRole: "first", morale: 70 })
    .where(and(eq(schema.careerPlayerState.careerId, t.careerId), eq(schema.careerPlayerState.playerId, t.playerId)));
  await tx
    .update(schema.careerClubs)
    .set({ balance: sql`${schema.careerClubs.balance} - ${t.fee}` })
    .where(and(eq(schema.careerClubs.careerId, t.careerId), eq(schema.careerClubs.clubId, t.buyerId)));
  await tx
    .update(schema.careerClubs)
    .set({ balance: sql`${schema.careerClubs.balance} + ${t.fee}` })
    .where(and(eq(schema.careerClubs.careerId, t.careerId), eq(schema.careerClubs.clubId, t.sellerId)));
  // outras propostas pelo mesmo jogador caem
  await tx
    .update(schema.transferOffers)
    .set({ status: "withdrawn" })
    .where(and(eq(schema.transferOffers.careerId, t.careerId), eq(schema.transferOffers.playerId, t.playerId), eq(schema.transferOffers.status, "pending")));
  const clubs = await tx.select().from(schema.clubs).where(inArray(schema.clubs.id, [t.sellerId, t.buyerId]));
  const name = (id: number) => clubs.find((c) => c.id === id)!.name;
  const members = await tx.select().from(schema.careerMembers).where(eq(schema.careerMembers.careerId, t.careerId));
  const human = new Set(members.map((m) => m.clubId));
  const tx2: (typeof schema.clubTransactions.$inferInsert)[] = [];
  if (human.has(t.buyerId)) tx2.push({ careerId: t.careerId, clubId: t.buyerId, season: t.season, day: t.day, kind: "transfer_out", amount: -t.fee, description: `Compra de ${t.playerName} (${name(t.sellerId)})` });
  if (human.has(t.sellerId)) tx2.push({ careerId: t.careerId, clubId: t.sellerId, season: t.season, day: t.day, kind: "transfer_in", amount: t.fee, description: `Venda de ${t.playerName} (${name(t.buyerId)})` });
  if (tx2.length) await tx.insert(schema.clubTransactions).values(tx2);
  await tx.insert(schema.careerNews).values({
    careerId: t.careerId,
    season: t.season,
    round: t.day,
    kind: "transfer",
    clubId: null,
    text: `${t.playerName} deixa o ${name(t.sellerId)} e acerta com o ${name(t.buyerId)} por R$ ${t.fee.toLocaleString("pt-BR")}.`,
  });
}
