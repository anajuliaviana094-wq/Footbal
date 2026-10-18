import { describe, expect, it } from "vitest";
import { doubleRoundRobin } from "./fixtures";
import { applyResultToStandings, applyRound, sortStandings, type PlayerState, type StandingRow } from "./rules";
import type { PlayerMatchStats } from "@/engine/types";

describe("calendário", () => {
  it("turno e returno: cada time enfrenta todos 2x, 1 jogo por rodada", () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    const fx = doubleRoundRobin(ids, 1);
    expect(fx.length).toBe(380);
    for (let r = 1; r <= 38; r++) {
      const round = fx.filter((f) => f.round === r);
      const teams = round.flatMap((f) => [f.home, f.away]);
      expect(new Set(teams).size).toBe(20);
    }
    for (const a of ids) {
      expect(fx.filter((f) => f.home === a).length).toBe(19);
      for (const b of ids) if (a !== b) expect(fx.filter((f) => f.home === a && f.away === b).length).toBe(1);
    }
  });
});

function state(id: number, over: Partial<PlayerState> = {}): PlayerState {
  return { playerId: id, clubId: 1, condition: 100, morale: 60, yellowAccum: 0, suspendedRounds: 0, injuryDays: 0, ageDelta: 0, progression: 0, appearances: 0, goals: 0, assists: 0, yellows: 0, reds: 0, ratingSum: 0, ...over };
}
function ms(id: number, over: Partial<PlayerMatchStats> = {}): PlayerMatchStats {
  return { playerId: id, side: "home", rating: 6.5, minutes: 90, goals: 0, assists: 0, yellows: 0, red: false, secondYellow: false, injured: false, injuryDays: 0, condition: 70, started: true, ...over };
}

describe("regras pós-rodada", () => {
  it("3º amarelo suspende por 1 rodada, cumprida na rodada seguinte", () => {
    const states = new Map([[1, state(1, { yellowAccum: 2 })]]);
    applyRound(states, [ms(1, { yellows: 1 })], new Map([[1, "W"]]), new Map());
    expect(states.get(1)!.suspendedRounds).toBe(1);
    expect(states.get(1)!.yellowAccum).toBe(0);
    applyRound(states, [], new Map([[1, "W"]]), new Map());
    expect(states.get(1)!.suspendedRounds).toBe(0);
  });

  it("vermelho direto suspende 2 rodadas; segundo amarelo, 1", () => {
    const states = new Map([[1, state(1)], [2, state(2)]]);
    applyRound(states, [ms(1, { red: true }), ms(2, { red: true, secondYellow: true })], new Map(), new Map());
    expect(states.get(1)!.suspendedRounds).toBe(2);
    expect(states.get(2)!.suspendedRounds).toBe(1);
  });

  it("lesão recupera 7 dias por rodada", () => {
    const states = new Map([[1, state(1)]]);
    applyRound(states, [ms(1, { injured: true, injuryDays: 12 })], new Map(), new Map());
    expect(states.get(1)!.injuryDays).toBe(12);
    applyRound(states, [], new Map(), new Map());
    expect(states.get(1)!.injuryDays).toBe(5);
    applyRound(states, [], new Map(), new Map());
    expect(states.get(1)!.injuryDays).toBe(0);
  });

  it("tabela ordena por pontos, vitórias e saldo", () => {
    const rows = new Map<number, StandingRow>();
    for (const id of [1, 2, 3]) rows.set(id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: "" });
    applyResultToStandings(rows, 1, 2, 3, 0);
    applyResultToStandings(rows, 3, 1, 1, 1);
    expect(sortStandings([...rows.values()]).map((r) => r.clubId)).toEqual([1, 3, 2]);
  });
});
