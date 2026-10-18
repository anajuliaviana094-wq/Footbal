import { describe, expect, it } from "vitest";
import { simulateMatch } from "./simulate";
import { teamFor, world } from "./testkit";
import { Rng } from "./rng";

describe("simulateMatch", () => {
  it("é determinístico: mesmo seed = mesmo resultado", () => {
    const [a, b] = world().clubs;
    const input = { home: teamFor(a.id), away: teamFor(b.id), seed: 42, detailed: true };
    const r1 = simulateMatch(input);
    const r2 = simulateMatch(input);
    expect(r1).toEqual(r2);
    expect(r1.frames!.length).toBe(r1.finalTick);
    expect(r1.frames![10].p.length).toBe(22);
  });

  it("modo rápido e detalhado produzem o mesmo placar e eventos", () => {
    const [a, b] = world().clubs;
    const base = { home: teamFor(a.id), away: teamFor(b.id), seed: 7 };
    const fast = simulateMatch({ ...base, detailed: false });
    const full = simulateMatch({ ...base, detailed: true });
    expect(fast.events).toEqual(full.events);
    expect(fast.frames).toBeUndefined();
  });

  it("mudanças no meio do jogo preservam o trecho anterior", () => {
    const [a, b] = world().clubs;
    const home = teamFor(a.id, false);
    const away = teamFor(b.id);
    const base = { home, away, seed: 99, detailed: true };
    const original = simulateMatch(base);
    const changeTick = 150;
    const out = home.starters[9];
    const inc = home.bench[3];
    const changed = simulateMatch({
      ...base,
      changes: [{ tick: changeTick, side: "home", subs: [{ outId: out.id, inId: inc.id }], tactics: { style: "ofensivo" } }],
    });
    const before = (r: typeof original) => r.events.filter((e) => e.tick < changeTick);
    expect(before(changed)).toEqual(before(original));
    expect(changed.frames!.slice(0, changeTick)).toEqual(original.frames!.slice(0, changeTick));
    expect(changed.events.some((e) => e.type === "sub" && e.playerId === inc.id && e.tick === changeTick)).toBe(true);
  });

  it("estatísticas realistas em 1.000 jogos", () => {
    const w = world();
    const rng = new Rng(2026);
    const N = 1000;
    let goals = 0, yellows = 0, redGames = 0, fouls = 0, shots = 0, homeWins = 0, draws = 0, penalties = 0, injuries = 0;
    for (let i = 0; i < N; i++) {
      const league = rng.pick(w.leagues);
      const clubs = w.clubs.filter((c) => c.leagueId === league.id);
      const h = rng.pick(clubs);
      let a = rng.pick(clubs);
      while (a.id === h.id) a = rng.pick(clubs);
      const r = simulateMatch({ home: teamFor(h.id), away: teamFor(a.id), seed: rng.int(1, 1e9), detailed: false });
      goals += r.homeGoals + r.awayGoals;
      yellows += r.stats.home.yellows + r.stats.away.yellows;
      fouls += r.stats.home.fouls + r.stats.away.fouls;
      shots += r.stats.home.shots + r.stats.away.shots;
      if (r.stats.home.reds + r.stats.away.reds > 0) redGames++;
      if (r.homeGoals > r.awayGoals) homeWins++;
      if (r.homeGoals === r.awayGoals) draws++;
      penalties += r.events.filter((e) => e.type === "penalty").length;
      injuries += r.events.filter((e) => e.type === "injury").length;
    }
    const s = {
      goals: goals / N, yellows: yellows / N, redRate: redGames / N, fouls: fouls / N, shots: shots / N,
      homeWin: homeWins / N, draw: draws / N, penalties: penalties / N, injuries: injuries / N,
    };
    console.log(s);
    expect(s.goals).toBeGreaterThan(2.2);
    expect(s.goals).toBeLessThan(2.8);
    expect(s.yellows).toBeGreaterThan(3.4);
    expect(s.yellows).toBeLessThan(4.6);
    expect(s.redRate).toBeGreaterThan(0.08);
    expect(s.redRate).toBeLessThan(0.17);
    expect(s.homeWin).toBeGreaterThan(s.draw);
  });
});
