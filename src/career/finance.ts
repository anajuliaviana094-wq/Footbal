import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { FinanceKind } from "@/db/schema";
import type { CareerContext } from "./context";
import { matchdayIncome } from "./economy";
import { loadSquad } from "./squad";

export const FINANCE_LABEL: Record<FinanceKind, string> = {
  ticket: "Bilheteria",
  tv: "Cotas de TV",
  sponsor: "Patrocínio",
  prize: "Premiações",
  wages: "Salários",
  transfer_in: "Vendas de jogadores",
  transfer_out: "Compras de jogadores",
  academy: "Investimento na base",
};

export async function getFinances(ctx: CareerContext) {
  const db = getDb();
  const tx = await db
    .select()
    .from(schema.clubTransactions)
    .where(
      and(
        eq(schema.clubTransactions.careerId, ctx.career.id),
        eq(schema.clubTransactions.clubId, ctx.clubId),
        eq(schema.clubTransactions.season, ctx.career.season),
      ),
    )
    .orderBy(desc(schema.clubTransactions.id));
  const byKind = new Map<FinanceKind, number>();
  for (const t of tx) byKind.set(t.kind, (byKind.get(t.kind) ?? 0) + t.amount);
  const squad = await loadSquad(db, ctx.career.id, ctx.clubId);
  const monthlyWages = squad.reduce((s, p) => s + p.wage, 0);
  const est = matchdayIncome({ level: ctx.league.level, strength: ctx.club.strength, capacity: ctx.cclub.capacity, isHome: true, form: 0.5 });
  return {
    balance: ctx.cclub.balance,
    capacity: ctx.cclub.capacity,
    monthlyWages,
    weeklyWages: Math.round(monthlyWages / 4.33),
    estimate: est,
    summary: [...byKind.entries()].map(([kind, amount]) => ({ kind, label: FINANCE_LABEL[kind], amount })).sort((a, b) => b.amount - a.amount),
    recent: tx.slice(0, 40),
    topWages: [...squad].sort((a, b) => b.wage - a.wage).slice(0, 8),
  };
}
