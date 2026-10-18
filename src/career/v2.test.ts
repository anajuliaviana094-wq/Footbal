import { describe, expect, it } from "vitest";
import { buildCalendar } from "./calendar";
import { cupStageCount, firstCupStage, nextCupStage } from "./cup";
import { evaluateBid } from "./transfers";
import { leaguePrize, matchdayIncome, playerMarketValue } from "./economy";
import { penaltyShootout } from "@/engine/shootout";
import { world, toEnginePlayer } from "@/engine/testkit";

describe("calendário e copa", () => {
  it("intercala as fases da copa na temporada", () => {
    const cal = buildCalendar(38, 6);
    expect(cal.filter((d) => d.type === "league").length).toBe(38);
    expect(cal.filter((d) => d.type === "cup").map((d) => d.round)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cal.map((d) => d.day)).toEqual(cal.map((_, i) => i + 1));
  });

  it("chave com byes fecha em potência de 2", () => {
    const clubs = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(cupStageCount(40)).toBe(6);
    const { pairs, byes } = firstCupStage(clubs, 1);
    expect(byes.length).toBe(24);
    expect(pairs.length).toBe(8);
    expect(byes.length + pairs.length).toBe(32);
    const all = new Set([...byes, ...pairs.flat()]);
    expect(all.size).toBe(40);
    expect(nextCupStage([...byes, ...pairs.map((p) => p[0])], 2).length).toBe(16);
    expect(firstCupStage(Array.from({ length: 16 }, (_, i) => i), 3).byes.length).toBe(0);
  });
});

describe("pênaltis", () => {
  it("sempre tem vencedor e é determinístico", () => {
    const ps = world().players.slice(0, 22).map(toEnginePlayer);
    for (let s = 0; s < 200; s++) {
      const r = penaltyShootout({ takers: ps.slice(0, 11), gk: ps[0] }, { takers: ps.slice(11), gk: ps[11] }, s);
      expect(r.home).not.toBe(r.away);
      expect(r).toEqual(penaltyShootout({ takers: ps.slice(0, 11), gk: ps[0] }, { takers: ps.slice(11), gk: ps[11] }, s));
    }
  });
});

describe("economia e mercado", () => {
  it("valor sobe com potencial e boa fase", () => {
    const base = { overall: 70, age: 21, potential: 70, avgRating: null, appearances: 0 };
    expect(playerMarketValue({ ...base, potential: 85 })).toBeGreaterThan(playerMarketValue(base));
    expect(playerMarketValue({ ...base, avgRating: 7.8, appearances: 10 })).toBeGreaterThan(playerMarketValue(base));
  });

  it("receita de mandante inclui bilheteria e prêmio cai com a posição", () => {
    const home = matchdayIncome({ level: 72, strength: 72, capacity: 30000, isHome: true, form: 0.5 });
    const away = matchdayIncome({ level: 72, strength: 72, capacity: 30000, isHome: false, form: 0.5 });
    expect(home.ticket).toBeGreaterThan(0);
    expect(away.ticket).toBe(0);
    expect(leaguePrize(72, 1, 20)).toBeGreaterThan(leaguePrize(72, 20, 20));
  });

  it("proposta abaixo do pedido é recusada com contraproposta", () => {
    const ctx = { fee: 1_000_000, wage: 50_000, value: 1_000_000, currentWage: 40_000, isKeyPlayer: false, sellerSquadSize: 25, samePositionCount: 4, sellerRich: false, buyerStrength: 70, sellerStrength: 70 };
    const low = evaluateBid({ ...ctx, fee: 500_000 });
    expect(low.accepted).toBe(false);
    expect(evaluateBid({ ...ctx, fee: 1_200_000 }).accepted).toBe(true);
    expect(evaluateBid({ ...ctx, fee: 1_200_000, wage: 41_000, sellerStrength: 80 }).accepted).toBe(false);
  });
});
