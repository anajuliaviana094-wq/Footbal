import { FORMATION_SLOTS, positionFit, type Slot } from "./formations";
import { Rng, hashSeed } from "./rng";
import {
  TICKS_PER_MINUTE,
  type Attributes,
  type EnginePlayer,
  type EventType,
  type Frame,
  type MatchChange,
  type MatchEvent,
  type MatchInput,
  type MatchResult,
  type PlayerMatchStats,
  type Side,
  type Tactics,
  type TeamInput,
  type TeamStats,
} from "./types";

/** Versão do motor; replays salvos só são válidos na mesma versão. */
export const ENGINE_VERSION = 1;

const MAX_SUBS = 5;
const HALF_TICKS = 45 * TICKS_PER_MINUTE;
const HOME_BONUS = 2.5;

// ---------- estruturas internas ----------

interface LivePlayer {
  p: EnginePlayer;
  side: Side;
  started: boolean;
  onPitch: boolean;
  sentOff: boolean;
  injured: boolean;
  injuryDays: number;
  cond: number;
  form: number;
  yellows: number;
  secondYellow: boolean;
  rating: number;
  goals: number;
  assists: number;
  tickIn: number | null;
  tickOut: number | null;
}

interface LiveTeam {
  side: Side;
  input: TeamInput;
  tactics: Tactics;
  slots: Slot[];
  /** ocupante de cada slot (null = vazio, após expulsão) */
  slotPlayers: (LivePlayer | null)[];
  bench: LivePlayer[];
  all: Map<number, LivePlayer>;
  subsUsed: number;
  stats: TeamStats;
  possessionTicks: number;
  morale: number;
  discipline: number;
  leadership: number;
  goals: number;
}

type PendingSetPiece =
  | { kind: "penalty"; side: Side }
  | { kind: "freekick"; side: Side }
  | { kind: "corner"; side: Side }
  | null;

// ---------- helpers ----------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function other(side: Side): Side {
  return side === "home" ? "away" : "home";
}

function makeLive(p: EnginePlayer, side: Side, started: boolean, rng: Rng): LivePlayer {
  const sd = (100 - p.traits.consistencia) / 14;
  return {
    p,
    side,
    started,
    onPitch: started,
    sentOff: false,
    injured: false,
    injuryDays: 0,
    cond: clamp(p.condition, 1, 100),
    form: rng.gauss(0, sd),
    yellows: 0,
    secondYellow: false,
    rating: 6.0,
    goals: 0,
    assists: 0,
    tickIn: started ? 0 : null,
    tickOut: null,
  };
}

function emptyStats(): TeamStats {
  return { possession: 0, shots: 0, shotsOnTarget: 0, fouls: 0, yellows: 0, reds: 0, corners: 0 };
}

function buildTeam(input: TeamInput, side: Side, rng: Rng): LiveTeam {
  const all = new Map<number, LivePlayer>();
  const slotPlayers = input.starters.slice(0, 11).map((p) => {
    const lp = makeLive(p, side, true, rng);
    all.set(p.id, lp);
    return lp;
  });
  const bench = input.bench.map((p) => {
    const lp = makeLive(p, side, false, rng);
    all.set(p.id, lp);
    return lp;
  });
  const team: LiveTeam = {
    side,
    input,
    tactics: { ...input.tactics },
    slots: FORMATION_SLOTS[input.tactics.formation],
    slotPlayers,
    bench,
    all,
    subsUsed: 0,
    stats: emptyStats(),
    possessionTicks: 0,
    morale: 50,
    discipline: 1,
    leadership: 0,
    goals: 0,
  };
  refreshTeamFactors(team);
  return team;
}

function onPitch(team: LiveTeam): LivePlayer[] {
  return team.slotPlayers.filter((p): p is LivePlayer => p !== null);
}

function refreshTeamFactors(team: LiveTeam): void {
  const ps = onPitch(team);
  if (!ps.length) return;
  team.morale = ps.reduce((s, p) => s + p.p.morale, 0) / ps.length;
  team.discipline = ps.reduce((s, p) => s + p.p.traits.disciplina_tatica, 0) / ps.length / 70;
  team.leadership = Math.max(...ps.map((p) => p.p.traits.lideranca));
}

function slotIndexOf(team: LiveTeam, lp: LivePlayer): number {
  return team.slotPlayers.indexOf(lp);
}

/** Valor efetivo (0–1) de um atributo considerando condição, encaixe, forma, mando e moral. */
function eff(team: LiveTeam, lp: LivePlayer, key: keyof Attributes): number {
  const idx = slotIndexOf(team, lp);
  const role = idx >= 0 ? team.slots[idx].role : lp.p.position;
  const fit = positionFit(lp.p.position, role);
  let v = lp.p.attrs[key] * fit * (0.72 + 0.28 * (lp.cond / 100));
  v += lp.form;
  v += (team.morale - 50) / 12;
  v += Math.max(0, team.leadership - 70) / 15;
  if (team.side === "home") v += HOME_BONUS;
  if (lp.injured) v -= 15;
  return clamp(v, 1, 110) / 100;
}

function zoneTargetX(z: number): number {
  return 0.1 + z * 0.18;
}

function pickByZone(team: LiveTeam, z: number, rng: Rng, includeGk: boolean): LivePlayer | null {
  const target = zoneTargetX(z);
  const items: LivePlayer[] = [];
  const weights: number[] = [];
  team.slotPlayers.forEach((lp, i) => {
    if (!lp) return;
    const slot = team.slots[i];
    if (slot.role === "GOL" && !includeGk) return;
    const d = slot.x - target;
    let w = Math.exp(-(d * d) / 0.035) + 0.02;
    if (slot.role === "GOL") w *= 0.4;
    items.push(lp);
    weights.push(w);
  });
  if (!items.length) return null;
  return rng.weighted(items, weights);
}

function goalkeeper(team: LiveTeam): LivePlayer | null {
  return team.slotPlayers[0];
}

function numbersFactor(team: LiveTeam): number {
  return 0.035 * (11 - onPitch(team).length);
}

// ---------- simulação ----------

export function simulateMatch(input: MatchInput): MatchResult {
  let rng = new Rng(input.seed);
  const visRng = new Rng(hashSeed(input.seed, "vis"));
  const setupRng = new Rng(hashSeed(input.seed, "setup"));

  const teams: Record<Side, LiveTeam> = {
    home: buildTeam(input.home, "home", setupRng),
    away: buildTeam(input.away, "away", setupRng),
  };

  const stoppage1 = setupRng.int(1, 3);
  const stoppage2 = setupRng.int(2, 6);
  const halftimeTick = HALF_TICKS + stoppage1 * TICKS_PER_MINUTE;
  const finalTick = halftimeTick + HALF_TICKS + stoppage2 * TICKS_PER_MINUTE;

  const events: MatchEvent[] = [];
  const frames: Frame[] = [];
  const changesByTick = new Map<number, MatchChange[]>();
  for (const c of input.changes ?? []) {
    const list = changesByTick.get(c.tick) ?? [];
    list.push(c);
    changesByTick.set(c.tick, list);
  }

  let possession: Side = "home";
  let zone = 2;
  let laneY = 0.5;
  let pending: PendingSetPiece = null;
  let chanceBoost: "big" | "key" | null = null;
  let lastPasser: { lp: LivePlayer; tick: number } | null = null;
  let tick = 0;
  let eventCounter = 0;
  let ballOverride: [number, number] | null = null;
  let actorThisTick: LivePlayer | null = null;
  let defenderThisTick: LivePlayer | null = null;

  const minuteOf = (t: number): number =>
    t < halftimeTick ? Math.floor(t / TICKS_PER_MINUTE) + 1 : 45 + Math.floor((t - halftimeTick) / TICKS_PER_MINUTE) + 1;

  function emit(
    type: EventType,
    side: Side | null,
    lp?: LivePlayer | null,
    otherLp?: LivePlayer | null,
    detail?: MatchEvent["detail"],
  ): void {
    const ev: MatchEvent = {
      key: `${tick}-${eventCounter++}-${type}`,
      tick,
      minute: minuteOf(tick),
      type,
      side,
      score: [teams.home.goals, teams.away.goals],
    };
    if (lp) {
      ev.playerId = lp.p.id;
      ev.playerName = lp.p.name;
    }
    if (otherLp) {
      ev.otherId = otherLp.p.id;
      ev.otherName = otherLp.p.name;
    }
    if (detail) ev.detail = detail;
    events.push(ev);
  }

  // ----- substituições / expulsões -----

  function removeFromPitch(team: LiveTeam, lp: LivePlayer): number {
    const idx = slotIndexOf(team, lp);
    if (idx >= 0) team.slotPlayers[idx] = null;
    lp.onPitch = false;
    lp.tickOut = tick;
    return idx;
  }

  function doSub(team: LiveTeam, out: LivePlayer, inc: LivePlayer, reason: string): boolean {
    if (team.subsUsed >= MAX_SUBS) return false;
    if (!out.onPitch || out.sentOff) return false;
    if (inc.onPitch || inc.tickIn !== null || inc.sentOff) return false;
    const idx = removeFromPitch(team, out);
    if (idx < 0) return false;
    team.slotPlayers[idx] = inc;
    inc.onPitch = true;
    inc.tickIn = tick;
    team.subsUsed++;
    emit("sub", team.side, inc, out, { reason, slot: idx });
    refreshTeamFactors(team);
    return true;
  }

  function bestBenchFor(team: LiveTeam, role: Slot["role"]): LivePlayer | null {
    let best: LivePlayer | null = null;
    let bestScore = -1;
    for (const b of team.bench) {
      if (b.tickIn !== null || b.sentOff) continue;
      const score = positionFit(b.p.position, role) * 100 + b.cond / 10;
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  function ensureGoalkeeper(team: LiveTeam): void {
    if (team.slotPlayers[0]) return;
    const gk = team.bench.find((b) => b.p.position === "GOL" && b.tickIn === null);
    if (gk && team.subsUsed < MAX_SUBS) {
      // sai o jogador mais avançado para entrar o goleiro reserva
      let outIdx = -1;
      let maxX = -1;
      team.slotPlayers.forEach((lp, i) => {
        if (lp && i > 0 && team.slots[i].x > maxX) {
          maxX = team.slots[i].x;
          outIdx = i;
        }
      });
      if (outIdx > 0) {
        const out = team.slotPlayers[outIdx]!;
        removeFromPitch(team, out);
        team.slotPlayers[0] = gk;
        gk.onPitch = true;
        gk.tickIn = tick;
        team.subsUsed++;
        emit("sub", team.side, gk, out, { reason: "goleiro", slot: 0 });
        refreshTeamFactors(team);
        return;
      }
    }
    // linha vai para o gol
    for (let i = team.slotPlayers.length - 1; i > 0; i--) {
      const lp = team.slotPlayers[i];
      if (lp) {
        team.slotPlayers[i] = null;
        team.slotPlayers[0] = lp;
        return;
      }
    }
  }

  function sendOff(team: LiveTeam, lp: LivePlayer): void {
    lp.sentOff = true;
    lp.rating -= 1.5;
    team.stats.reds++;
    const idx = removeFromPitch(team, lp);
    if (idx === 0) ensureGoalkeeper(team);
    refreshTeamFactors(team);
  }

  function handleInjury(team: LiveTeam, lp: LivePlayer): void {
    if (lp.injured) return;
    lp.injured = true;
    const r = rng.next();
    lp.injuryDays = r < 0.6 ? rng.int(3, 10) : r < 0.9 ? rng.int(11, 30) : rng.int(31, 90);
    emit("injury", team.side, lp, null, { days: lp.injuryDays });
    const idx = slotIndexOf(team, lp);
    const role = idx >= 0 ? team.slots[idx].role : lp.p.position;
    const inc = bestBenchFor(team, role);
    if (inc && team.subsUsed < MAX_SUBS) {
      doSub(team, lp, inc, "lesão");
    } else {
      lp.cond = Math.min(lp.cond, 40);
    }
  }

  function applyChange(change: MatchChange): void {
    const team = teams[change.side];
    if (change.tactics) {
      const prevFormation = team.tactics.formation;
      team.tactics = { ...team.tactics, ...change.tactics };
      if (team.tactics.formation !== prevFormation) {
        team.slots = FORMATION_SLOTS[team.tactics.formation];
      }
      emit("tactic", change.side, null, null, {
        formation: team.tactics.formation,
        style: team.tactics.style,
      });
    }
    for (const s of change.subs ?? []) {
      const out = team.all.get(s.outId);
      const inc = team.all.get(s.inId);
      if (out && inc) doSub(team, out, inc, "técnico");
    }
  }

  function autoManage(team: LiveTeam): void {
    if (!team.input.autoSubs) return;
    const minute = minuteOf(tick);
    const isWindow = tick > halftimeTick && [60, 70, 80].includes(minute) && (tick - halftimeTick) % TICKS_PER_MINUTE === 0;
    if (!isWindow) return;
    const [limit, count] = minute === 60 ? [80, 1] : minute === 70 ? [77, 2] : [75, 2];
    const tired = onPitch(team)
      .filter((lp) => slotIndexOf(team, lp) > 0 && (lp.cond < limit || lp.yellows > 0 && lp.p.traits.agressividade > 75))
      .sort((a, b) => a.cond - b.cond)
      .slice(0, count);
    for (const lp of tired) {
      const role = team.slots[slotIndexOf(team, lp)].role;
      const inc = bestBenchFor(team, role);
      if (inc) doSub(team, lp, inc, "cansaço");
    }
    const opp = teams[other(team.side)];
    if (minute === 70 && team.goals < opp.goals && team.tactics.style !== "ofensivo") {
      team.tactics = { ...team.tactics, style: "ofensivo" };
      emit("tactic", team.side, null, null, { formation: team.tactics.formation, style: "ofensivo" });
    }
  }

  // ----- cartões, faltas, lesões -----

  function bookPlayer(team: LiveTeam, lp: LivePlayer, reason: string): void {
    if (lp.yellows >= 1) {
      lp.yellows = 2;
      lp.secondYellow = true;
      team.stats.yellows++;
      emit("second_yellow", team.side, lp, null, { reason });
      sendOff(team, lp);
    } else {
      lp.yellows = 1;
      lp.rating -= 0.4;
      team.stats.yellows++;
      emit("yellow", team.side, lp, null, { reason });
    }
  }

  function tension(): number {
    const diff = Math.abs(teams.home.goals - teams.away.goals);
    return minuteOf(tick) > 70 && diff <= 1 ? 0.035 : 0;
  }

  /** Falta cometida por `fouler` (time defensor) sobre `victim`. Retorna true se gerou pênalti. */
  function commitFoul(defTeam: LiveTeam, fouler: LivePlayer, attTeam: LiveTeam, victim: LivePlayer, tactical: boolean): void {
    defTeam.stats.fouls++;
    fouler.rating -= 0.1;
    emit("foul", defTeam.side, fouler, victim);

    const agr = fouler.p.traits.agressividade / 100;
    const tmp = fouler.p.traits.temperamento / 100;
    const directRed = 0.0006 + 0.008 * agr ** 4 + (tmp > 0.8 ? 0.003 : 0);
    if (rng.chance(directRed)) {
      emit("red", defTeam.side, fouler, null, { reason: "entrada violenta" });
      fouler.yellows = Math.max(fouler.yellows, 0);
      sendOff(defTeam, fouler);
    } else {
      let pYellow = 0.085 + 0.17 * agr * agr + tension() + (tactical ? 0.06 : 0);
      // já amarelado tende a se segurar — menos se for muito agressivo
      if (fouler.yellows > 0) pYellow *= agr >= 0.8 ? 0.55 : 0.32;
      if (rng.chance(pYellow)) {
        bookPlayer(defTeam, fouler, tactical ? "falta tática" : "falta");
      } else if (rng.chance((fouler.yellows > 0 ? 0.03 : 0.06) * tmp ** 3)) {
        // reclamação com o árbitro
        bookPlayer(defTeam, fouler, "reclamação");
      }
    }

    if (victim.onPitch && rng.chance(0.012 * (victim.p.traits.propensao_lesao / 50))) {
      handleInjury(attTeam, victim);
    }

    if (zone === 4 && rng.chance(tactical ? 0.28 : 0.12)) {
      pending = { kind: "penalty", side: attTeam.side };
      emit("penalty", attTeam.side, victim, fouler);
    } else if (zone >= 3 && rng.chance(0.3)) {
      pending = { kind: "freekick", side: attTeam.side };
    }
  }

  // ----- finalização -----

  function shoot(attTeam: LiveTeam, shooter: LivePlayer, baseXg: number, kind: string): void {
    const defTeam = teams[other(attTeam.side)];
    const gk = goalkeeper(defTeam);
    attTeam.stats.shots++;
    const fin = eff(attTeam, shooter, kind === "header" ? "cabeceio" : "finalizacao");
    let f = 0.35 + 1.15 * fin;
    const isPen = kind === "penalty";
    const big = kind === "big" || isPen;
    if (big) f *= 0.82 + 0.36 * (shooter.p.traits.frieza / 100);

    // bloqueio
    if (!isPen) {
      const blocker = pickByZone(defTeam, 0, rng, false);
      const pBlock = 0.1 + 0.1 * (blocker ? eff(defTeam, blocker, "posicionamento") : 0.5) - (kind === "big" ? 0.08 : 0);
      if (rng.chance(pBlock)) {
        emit("shot", attTeam.side, shooter, blocker, { blocked: true, big: kind === "big" });
        shooter.rating += 0.03;
        if (blocker) blocker.rating += 0.12;
        if (rng.chance(0.4)) pending = { kind: "corner", side: attTeam.side };
        else turnover(defTeam, 1);
        return;
      }
    }

    const pOnTarget = isPen ? 0.82 + 0.12 * (shooter.p.traits.frieza / 100) : 0.3 + 0.36 * fin + (kind === "big" ? 0.12 : 0);
    const goalX = attTeam.side === "home" ? 1 : 0;
    if (!rng.chance(pOnTarget)) {
      emit(isPen ? "penalty_miss" : "miss", attTeam.side, shooter, null, { big, xg: round2(baseXg) });
      shooter.rating -= big ? 0.35 : 0.05;
      ballOverride = [goalX === 1 ? 0.99 : 0.01, clamp(0.5 + visRng.range(-0.25, 0.25), 0.05, 0.95)];
      turnover(defTeam, 0);
      return;
    }
    attTeam.stats.shotsOnTarget++;
    const gkVal = gk ? 0.6 * eff(defTeam, gk, "reflexo") + 0.4 * eff(defTeam, gk, "posicionamento") : 0.2;
    const gkFactor = 1.35 - 0.7 * gkVal;
    const pGoal = isPen ? clamp(0.88 * (1.15 - 0.35 * gkVal) * (0.7 + 0.3 * f), 0.4, 0.95) : clamp(baseXg * f * 1.9 * gkFactor, 0.02, 0.92);

    if (rng.chance(pGoal)) {
      attTeam.goals++;
      shooter.goals++;
      shooter.rating += 1.0 + (["ZAG", "LAT", "VOL"].includes(shooter.p.position) ? 0.3 : 0);
      let assister: LivePlayer | null = null;
      if (!isPen && lastPasser && lastPasser.lp !== shooter && tick - lastPasser.tick <= 3 && lastPasser.lp.side === attTeam.side && lastPasser.lp.onPitch) {
        assister = lastPasser.lp;
        assister.assists++;
        assister.rating += 0.6;
      }
      if (gk) gk.rating -= 0.3;
      for (const d of onPitch(defTeam)) if (["ZAG", "LAT"].includes(d.p.position)) d.rating -= 0.1;
      ballOverride = [goalX, 0.5];
      emit("goal", attTeam.side, shooter, assister, { kind, xg: round2(baseXg) });
      // nova saída de bola
      possession = defTeam.side;
      zone = 2;
      laneY = 0.5;
      lastPasser = null;
      return;
    }
    // defesa
    shooter.rating += 0.1;
    if (gk) gk.rating += big ? 0.45 : 0.25;
    emit("save", attTeam.side, shooter, gk, { big, xg: round2(baseXg), penalty: isPen });
    ballOverride = [goalX === 1 ? 0.97 : 0.03, 0.5];
    if (rng.chance(0.3)) pending = { kind: "corner", side: attTeam.side };
    else turnover(defTeam, 0);
  }

  function turnover(newTeam: LiveTeam, newZone: number): void {
    possession = newTeam.side;
    zone = clamp(newZone, 0, 4);
    lastPasser = null;
    chanceBoost = null;
  }

  function pickHeader(team: LiveTeam): LivePlayer | null {
    const items: LivePlayer[] = [];
    const weights: number[] = [];
    team.slotPlayers.forEach((lp, i) => {
      if (!lp || i === 0) return;
      const r = team.slots[i].role;
      const w = (r === "ATA" ? 3 : r === "MEI" || r === "PON" ? 1.1 : r === "ZAG" ? 0.8 : 0.4) * (0.5 + lp.p.attrs.cabeceio / 100);
      items.push(lp);
      weights.push(w);
    });
    return items.length ? rng.weighted(items, weights) : null;
  }

  function resolveSetPiece(sp: NonNullable<PendingSetPiece>): void {
    const attTeam = teams[sp.side];
    const defTeam = teams[other(sp.side)];
    possession = sp.side;
    if (sp.kind === "penalty") {
      zone = 4;
      // batedor: maior frieza+finalização
      const taker = onPitch(attTeam)
        .filter((lp) => slotIndexOf(attTeam, lp) > 0)
        .sort((a, b) => b.p.attrs.finalizacao + b.p.traits.frieza - (a.p.attrs.finalizacao + a.p.traits.frieza))[0];
      if (taker) {
        actorThisTick = taker;
        shoot(attTeam, taker, 0.76, "penalty");
      }
      return;
    }
    if (sp.kind === "freekick") {
      zone = 3;
      const taker = onPitch(attTeam)
        .filter((lp) => slotIndexOf(attTeam, lp) > 0)
        .sort((a, b) => b.p.attrs.finalizacao + b.p.attrs.passe - (a.p.attrs.finalizacao + a.p.attrs.passe))[0];
      if (taker) {
        actorThisTick = taker;
        if (rng.chance(0.45)) shoot(attTeam, taker, 0.06, "freekick");
        else zone = 4;
      }
      return;
    }
    // escanteio
    attTeam.stats.corners++;
    emit("corner", attTeam.side, null);
    zone = 4;
    laneY = rng.chance(0.5) ? 0.05 : 0.95;
    if (rng.chance(0.3)) {
      const header = pickHeader(attTeam);
      if (header) {
        actorThisTick = header;
        shoot(attTeam, header, 0.075, "header");
      }
    } else if (rng.chance(0.65)) {
      turnover(defTeam, 1);
    }
  }

  // ----- ação principal -----

  function playTick(): void {
    const attTeam = teams[possession];
    const defTeam = teams[other(possession)];
    attTeam.possessionTicks++;

    if (pending) {
      const sp = pending;
      pending = null;
      resolveSetPiece(sp);
      return;
    }

    const actor = pickByZone(attTeam, zone, rng, zone === 0);
    const defender = pickByZone(defTeam, 4 - zone, rng, false);
    if (!actor || !defender) return;
    actorThisTick = actor;
    defenderThisTick = defender;

    const disc = attTeam.discipline;
    const dDisc = defTeam.discipline;
    const pressAdj = { baixa: -0.02, media: 0, alta: 0.035 }[defTeam.tactics.pressing] * dDisc;
    const markAdj = defTeam.tactics.marking === "individual" ? 0.025 * dDisc : 0;
    const shellAdj = defTeam.tactics.style === "defensivo" && zone >= 3 ? 0.045 * dDisc : defTeam.tactics.style === "ofensivo" && zone >= 3 ? -0.02 : 0;
    const numbers = numbersFactor(attTeam) - numbersFactor(defTeam);

    // falta "de disputa" antes da ação
    const foulMult =
      (0.5 + defender.p.traits.agressividade / 100) *
      (defender.yellows > 0 ? 0.7 : 1) *
      (defTeam.tactics.pressing === "alta" ? 1.25 : defTeam.tactics.pressing === "baixa" ? 0.85 : 1) *
      (defTeam.tactics.marking === "individual" ? 1.15 : 1);
    if (rng.chance(0.042 * foulMult)) {
      commitFoul(defTeam, defender, attTeam, actor, false);
      return;
    }

    // escolha da ação
    const style = attTeam.tactics.style;
    const sMul = style === "ofensivo" ? 1.18 : style === "defensivo" ? 0.85 : 1;
    const base = [
      [0.8, 0.07, 0.13, 0, 0],
      [0.76, 0.12, 0.12, 0, 0],
      [0.7, 0.18, 0.08, 0.02, 0.02],
      [0.52, 0.22, 0.0, 0.14, 0.12],
      [0.3, 0.16, 0.0, 0.12, 0.42],
    ][zone];
    const a = actor.p.attrs;
    const weights = [
      base[0] * (0.8 + a.passe / 250) * (style === "defensivo" ? 1.12 : 1),
      base[1] * (0.6 + a.drible / 120) * sMul,
      base[2] * (style === "defensivo" ? 1.2 : 1),
      base[3] * (0.6 + a.cruzamento / 120) * sMul,
      base[4] * (0.6 + a.finalizacao / 120) * sMul * (chanceBoost ? 1.8 : 1),
    ];
    const action = rng.weighted(["pass", "dribble", "long", "cross", "shot"] as const, weights);
    laneY = clamp(laneY + rng.range(-0.18, 0.18), 0.08, 0.92);

    if (action === "shot") {
      const xg = chanceBoost === "big" ? 0.3 : chanceBoost === "key" ? 0.15 : zone === 4 ? 0.095 : 0.035;
      const kind = chanceBoost === "big" ? "big" : "normal";
      chanceBoost = null;
      shoot(attTeam, actor, xg, kind);
      return;
    }

    if (action === "pass") {
      const atk = 0.6 * eff(attTeam, actor, "passe") + 0.4 * eff(attTeam, actor, "visao");
      const def = 0.5 * eff(defTeam, defender, "marcacao") + 0.5 * eff(defTeam, defender, "posicionamento");
      const zonePen = [-0.06, -0.03, 0, 0.08, 0.16][zone];
      const p = 0.84 + 0.6 * (atk - def) - zonePen - (zone <= 2 ? pressAdj : 0) - markAdj - shellAdj + numbers + (disc - 1) * 0.03;
      if (rng.chance(p)) {
        actor.rating += 0.01;
        lastPasser = { lp: actor, tick };
        if (zone === 4) {
          chanceBoost = "key";
          actor.rating += 0.05;
        } else if (rng.chance([0.55, 0.5, 0.42, 0.3, 0][zone])) {
          zone++;
          chanceBoost = null;
        }
      } else {
        actor.rating -= 0.03;
        defender.rating += 0.05;
        if (rng.chance(0.1 * foulMult)) commitFoul(defTeam, defender, attTeam, actor, zone >= 2);
        else turnover(defTeam, counterZone(4 - zone, attTeam));
      }
      return;
    }

    if (action === "long") {
      const p = 0.45 + 0.45 * (eff(attTeam, actor, "passe") - eff(defTeam, defender, "posicionamento")) + numbers;
      if (rng.chance(p)) {
        lastPasser = { lp: actor, tick };
        zone = Math.min(4, zone + 2);
      } else {
        turnover(defTeam, 4 - Math.min(4, zone + 2));
      }
      return;
    }

    if (action === "dribble") {
      const atk = 0.6 * eff(attTeam, actor, "drible") + 0.4 * eff(attTeam, actor, "velocidade");
      const def = 0.6 * eff(defTeam, defender, "desarme") + 0.25 * eff(defTeam, defender, "velocidade") + 0.15 * eff(defTeam, defender, "forca");
      const p = 0.52 + 0.75 * (atk - def) - (zone >= 3 ? 0.05 : 0) - pressAdj - markAdj - shellAdj + numbers;
      if (rng.chance(p)) {
        actor.rating += 0.08;
        if (zone === 4) chanceBoost = "big";
        else zone++;
      } else {
        actor.rating -= 0.03;
        if (rng.chance(0.33 * foulMult)) {
          commitFoul(defTeam, defender, attTeam, actor, zone >= 2 && rng.chance(0.4));
        } else {
          defender.rating += 0.1;
          turnover(defTeam, counterZone(4 - zone, attTeam));
        }
      }
      return;
    }

    // cruzamento
    const p = 0.32 + 0.45 * (eff(attTeam, actor, "cruzamento") - 0.5 * (eff(defTeam, defender, "cabeceio") + eff(defTeam, defender, "marcacao"))) + numbers - shellAdj;
    laneY = rng.chance(0.5) ? 0.1 : 0.9;
    if (rng.chance(p)) {
      const header = pickHeader(attTeam);
      if (header) {
        lastPasser = { lp: actor, tick };
        actorThisTick = header;
        shoot(attTeam, header, 0.09, "header");
      }
    } else if (rng.chance(0.22)) {
      pending = { kind: "corner", side: attTeam.side };
    } else {
      turnover(defTeam, 0);
    }
  }

  function counterZone(z: number, losingTeam: LiveTeam): number {
    return losingTeam.tactics.style === "ofensivo" && z <= 1 ? z + 1 : z;
  }

  // ----- fadiga e lesões sem contato -----

  function fatigue(): void {
    for (const team of [teams.home, teams.away]) {
      const press = { baixa: 0, media: 0.015, alta: 0.035 }[team.tactics.pressing];
      for (const lp of onPitch(team)) {
        const isGk = slotIndexOf(team, lp) === 0;
        const drop = isGk ? 0.03 : 0.085 + 0.075 * (1 - lp.p.attrs.resistencia / 100) + press;
        lp.cond = Math.max(5, lp.cond - drop);
        if (!lp.injured && rng.chance(0.000022 * (lp.p.traits.propensao_lesao / 50) * (lp.cond < 50 ? 2 : 1))) {
          handleInjury(team, lp);
        }
      }
    }
  }

  // ----- frames -----

  function buildFrame(): Frame {
    const attSide = possession;
    const zx = zoneTargetX(zone) + 0.08;
    let ball: [number, number] = ballOverride ?? [
      clamp((attSide === "home" ? zx : 1 - zx) + visRng.range(-0.035, 0.035), 0.02, 0.98),
      clamp(laneY + visRng.range(-0.03, 0.03), 0.03, 0.97),
    ];
    ball = [round3(ball[0]), round3(ball[1])];
    const positions: ([number, number] | null)[] = [];
    for (const side of ["home", "away"] as const) {
      const team = teams[side];
      const ballF = side === "home" ? ball[0] : 1 - ball[0];
      const hasPoss = possession === side;
      team.slotPlayers.forEach((lp, i) => {
        if (!lp) {
          positions.push(null);
          return;
        }
        const s = team.slots[i];
        let x: number;
        let y: number;
        if (i === 0) {
          x = 0.035 + clamp(ballF - 0.5, -0.5, 0.5) * 0.07;
          y = 0.5 + (ball[1] - 0.5) * 0.25;
        } else {
          x = s.x * 0.74 + 0.1 + (ballF - 0.5) * 0.4 + (hasPoss ? 0.05 : -0.04);
          y = s.y + (ball[1] - 0.5) * 0.24 * (1 - Math.abs(s.y - 0.5));
          x += visRng.range(-0.012, 0.012);
          y += visRng.range(-0.012, 0.012);
        }
        if (lp === actorThisTick && !ballOverride) {
          x = ballF - 0.012;
          y = ball[1];
        } else if (lp === defenderThisTick && !ballOverride) {
          x = ballF + 0.025;
          y = ball[1] + 0.02;
        }
        x = clamp(x, 0.01, 0.99);
        y = clamp(y, 0.02, 0.98);
        positions.push([round3(side === "home" ? x : 1 - x), round3(y)]);
      });
    }
    return { t: tick, b: ball, p: positions, s: possession === "home" ? 0 : 1 };
  }

  // ----- loop principal -----

  emit("kickoff", null);
  for (tick = 0; tick < finalTick; tick++) {
    if (tick === halftimeTick) {
      emit("halftime", null);
      possession = "away";
      zone = 2;
      laneY = 0.5;
      pending = null;
      chanceBoost = null;
      for (const team of [teams.home, teams.away]) for (const lp of onPitch(team)) lp.cond = Math.min(100, lp.cond + 4);
    }
    const changes = changesByTick.get(tick);
    if (changes) {
      changes.forEach((c) => applyChange(c));
      rng = new Rng(hashSeed(input.seed, "chg", tick, changes.length));
    }
    autoManage(teams.home);
    autoManage(teams.away);

    ballOverride = null;
    actorThisTick = null;
    defenderThisTick = null;
    playTick();
    fatigue();
    if (input.detailed) frames.push(buildFrame());
  }
  tick = finalTick;
  emit("fulltime", null);

  // ----- finalização -----
  const totalPoss = teams.home.possessionTicks + teams.away.possessionTicks || 1;
  teams.home.stats.possession = Math.round((teams.home.possessionTicks / totalPoss) * 100);
  teams.away.stats.possession = 100 - teams.home.stats.possession;

  const players: PlayerMatchStats[] = [];
  for (const team of [teams.home, teams.away]) {
    const conceded = teams[other(team.side)].goals;
    for (const lp of team.all.values()) {
      if (lp.tickIn === null) continue;
      const end = lp.tickOut ?? finalTick;
      const minutes = Math.max(1, Math.round((end - lp.tickIn) / TICKS_PER_MINUTE));
      let rating = lp.rating;
      if (conceded === 0 && minutes >= 60 && ["GOL", "ZAG", "LAT"].includes(lp.p.position)) rating += 0.5;
      if (team.goals > conceded) rating += 0.2;
      else if (team.goals < conceded) rating -= 0.2;
      if (minutes < 15) rating = 6 + (rating - 6) * 0.5;
      players.push({
        playerId: lp.p.id,
        side: team.side,
        rating: round2(clamp(rating, 3, 10)),
        minutes,
        goals: lp.goals,
        assists: lp.assists,
        yellows: lp.secondYellow ? 0 : lp.yellows,
        red: lp.sentOff,
        secondYellow: lp.secondYellow,
        injured: lp.injured,
        injuryDays: lp.injured ? lp.injuryDays : 0,
        condition: Math.round(lp.cond),
        started: lp.started,
      });
    }
  }

  return {
    homeGoals: teams.home.goals,
    awayGoals: teams.away.goals,
    events,
    stats: { home: teams.home.stats, away: teams.away.stats },
    players,
    finalTick,
    halftimeTick,
    frames: input.detailed ? frames : undefined,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
