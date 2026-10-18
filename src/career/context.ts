import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { systemOfLeague, type LeagueSystem } from "@/data/leagues";
import { getDb, schema } from "@/db";
import type { CalendarDay } from "@/db/schema";
import { AppError } from "@/lib/errors";
import type { AppUser } from "@/lib/session";

export const MAX_CAREERS = 3;

export type CareerRow = typeof schema.careers.$inferSelect;
export type LeagueRow = typeof schema.leagues.$inferSelect;
export type ClubRow = typeof schema.clubs.$inferSelect;
export type MemberRow = typeof schema.careerMembers.$inferSelect;
export type CareerClubRow = typeof schema.careerClubs.$inferSelect;

export function canAccessLeague(user: Pick<AppUser, "plan">, league: Pick<LeagueRow, "isFree">): boolean {
  return league.isFree || user.plan === "premium";
}

export async function listLeagues(user: AppUser) {
  const leagues = await getDb().select().from(schema.leagues).orderBy(asc(schema.leagues.sortOrder));
  return leagues.map((l) => ({ ...l, locked: !canAccessLeague(user, l) }));
}

export interface CareerContext {
  career: CareerRow;
  member: MemberRow;
  /** clube comandado pelo usuário nesta carreira */
  clubId: number;
  club: ClubRow;
  /** divisão atual do clube do usuário */
  league: LeagueRow;
  cclub: CareerClubRow;
  system: LeagueSystem;
  isHost: boolean;
  /** dia de jogo atual do calendário */
  day: CalendarDay | null;
}

export function currentDay(career: Pick<CareerRow, "calendar" | "currentRound">): CalendarDay | null {
  return career.calendar?.[career.currentRound - 1] ?? null;
}

/** Carrega a carreira garantindo que o usuário é técnico dela e que o plano libera a divisão atual. */
export async function getCareer(user: AppUser, careerId: string): Promise<CareerContext> {
  const db = getDb();
  const [row] = await db
    .select({ career: schema.careers, member: schema.careerMembers })
    .from(schema.careerMembers)
    .innerJoin(schema.careers, eq(schema.careers.id, schema.careerMembers.careerId))
    .where(and(eq(schema.careerMembers.careerId, careerId), eq(schema.careerMembers.userId, user.id)))
    .limit(1);
  if (!row) {
    const [legacy] = await db
      .select({ id: schema.careers.id })
      .from(schema.careers)
      .where(and(eq(schema.careers.id, careerId), eq(schema.careers.userId, user.id), eq(schema.careers.version, 1)));
    if (legacy) throw new AppError("Esta carreira é de uma versão antiga do jogo. Exclua-a e comece uma nova para usar copas, mercado e finanças.", 410, "legacy");
    throw new AppError("Carreira não encontrada", 404, "not_found");
  }
  const { career, member } = row;
  const [cclub] = await db
    .select()
    .from(schema.careerClubs)
    .where(and(eq(schema.careerClubs.careerId, careerId), eq(schema.careerClubs.clubId, member.clubId)));
  const [club] = await db.select().from(schema.clubs).where(eq(schema.clubs.id, member.clubId));
  const [league] = await db.select().from(schema.leagues).where(eq(schema.leagues.id, cclub.leagueId));
  if (!canAccessLeague(user, league)) {
    throw new AppError(`Seu clube está na ${league.name}, exclusiva do plano Premium.`, 402, "premium_required");
  }
  return {
    career,
    member,
    clubId: member.clubId,
    club,
    league,
    cclub,
    system: systemOfLeague(club.leagueId),
    isHost: member.role === "host",
    day: currentDay(career),
  };
}

export async function countUserCareers(userId: string): Promise<number> {
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.careerMembers).where(eq(schema.careerMembers.userId, userId));
  const [{ legacy }] = await db
    .select({ legacy: count() })
    .from(schema.careers)
    .where(and(eq(schema.careers.userId, userId), eq(schema.careers.version, 1)));
  return n + legacy;
}

export async function listCareers(user: AppUser) {
  const db = getDb();
  const rows = await db
    .select({ career: schema.careers, member: schema.careerMembers, club: schema.clubs, cclub: schema.careerClubs })
    .from(schema.careerMembers)
    .innerJoin(schema.careers, eq(schema.careers.id, schema.careerMembers.careerId))
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careerMembers.clubId))
    .innerJoin(
      schema.careerClubs,
      and(eq(schema.careerClubs.careerId, schema.careerMembers.careerId), eq(schema.careerClubs.clubId, schema.careerMembers.clubId)),
    )
    .where(eq(schema.careerMembers.userId, user.id))
    .orderBy(sql`${schema.careers.updatedAt} desc`);
  const leagueIds = [...new Set(rows.map((r) => r.cclub.leagueId))];
  const leagues = leagueIds.length ? await db.select().from(schema.leagues).where(inArray(schema.leagues.id, leagueIds)) : [];
  const byId = new Map(leagues.map((l) => [l.id, l]));
  const memberCounts = rows.length
    ? await db
        .select({ careerId: schema.careerMembers.careerId, n: count() })
        .from(schema.careerMembers)
        .where(inArray(schema.careerMembers.careerId, rows.map((r) => r.career.id)))
        .groupBy(schema.careerMembers.careerId)
    : [];
  const countBy = new Map(memberCounts.map((m) => [m.careerId, m.n]));
  const legacy = await db
    .select({ career: schema.careers, club: schema.clubs })
    .from(schema.careers)
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careers.clubId))
    .where(and(eq(schema.careers.userId, user.id), eq(schema.careers.version, 1)));
  return {
    careers: rows.map((r) => {
      const league = byId.get(r.cclub.leagueId)!;
      return { ...r, league, locked: !canAccessLeague(user, league), members: countBy.get(r.career.id) ?? 1 };
    }),
    legacy,
  };
}

export async function deleteCareer(user: AppUser, careerId: string) {
  const db = getDb();
  const [own] = await db
    .select({ id: schema.careers.id })
    .from(schema.careers)
    .where(and(eq(schema.careers.id, careerId), eq(schema.careers.userId, user.id)));
  if (own) {
    // dono apaga a carreira inteira (e os jogadores da base criados nela)
    await db.delete(schema.careers).where(eq(schema.careers.id, careerId));
    await db.delete(schema.players).where(eq(schema.players.careerId, careerId));
    return;
  }
  // membro convidado apenas sai da liga
  await db.delete(schema.careerMembers).where(and(eq(schema.careerMembers.careerId, careerId), eq(schema.careerMembers.userId, user.id)));
}

export async function getMembers(careerId: string) {
  return getDb()
    .select({ member: schema.careerMembers, user: { id: schema.users.id, name: schema.users.name, email: schema.users.email }, club: schema.clubs })
    .from(schema.careerMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.careerMembers.userId))
    .innerJoin(schema.clubs, eq(schema.clubs.id, schema.careerMembers.clubId))
    .where(eq(schema.careerMembers.careerId, careerId))
    .orderBy(schema.careerMembers.joinedAt);
}

