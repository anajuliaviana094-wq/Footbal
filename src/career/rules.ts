import type { PlayerMatchStats } from "@/engine/types";

/** Estado mutável de um jogador na carreira (espelha career_player_state). */
export interface PlayerState {
  playerId: number;
  clubId: number;
  condition: number;
  morale: number;
  yellowAccum: number;
  suspendedRounds: number;
  injuryDays: number;
  ageDelta: number;
  progression: number;
  appearances: number;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
  ratingSum: number;
}

export const YELLOW_LIMIT = 3;
export const DAYS_PER_ROUND = 7;

export function isAvailable(s: Pick<PlayerState, "injuryDays" | "suspendedRounds">): boolean {
  return s.injuryDays <= 0 && s.suspendedRounds <= 0;
}

export interface RoundNews {
  playerId: number;
  clubId: number;
  kind: "suspension" | "injury" | "recovered";
  text?: string;
  rounds?: number;
  days?: number;
}

/**
 * Aplica o resultado de uma rodada aos estados dos jogadores.
 * - suspensões cumpridas são abatidas antes das novas;
 * - lesões antigas recuperam 7 dias; novas lesões entram depois;
 * - desgaste do jogo + recuperação semanal;
 * - moral varia com resultado e atuação.
 */
export function applyRound(
  states: Map<number, PlayerState>,
  matchStats: PlayerMatchStats[],
  clubResults: Map<number, "W" | "D" | "L">,
  resistencia: Map<number, number>,
): RoundNews[] {
  const news: RoundNews[] = [];
  const played = new Map(matchStats.map((s) => [s.playerId, s]));

  for (const st of states.values()) {
    // 1) cumprir suspensão / recuperar lesão (estado de antes da rodada)
    if (st.suspendedRounds > 0 && !played.has(st.playerId)) st.suspendedRounds--;
    if (st.injuryDays > 0) {
      st.injuryDays = Math.max(0, st.injuryDays - DAYS_PER_ROUND);
      if (st.injuryDays === 0) news.push({ playerId: st.playerId, clubId: st.clubId, kind: "recovered" });
    }

    const ms = played.get(st.playerId);
    const result = clubResults.get(st.clubId);
    if (ms) {
      st.appearances++;
      st.goals += ms.goals;
      st.assists += ms.assists;
      st.yellows += ms.yellows + (ms.secondYellow ? 1 : 0);
      st.ratingSum += ms.rating;
      st.condition = ms.condition;
      if (ms.red) {
        st.reds++;
        const rounds = ms.secondYellow ? 1 : 2;
        st.suspendedRounds += rounds;
        news.push({ playerId: st.playerId, clubId: st.clubId, kind: "suspension", rounds, text: ms.secondYellow ? "expulso (2º amarelo)" : "expulso (vermelho direto)" });
      }
      st.yellowAccum += ms.yellows;
      if (st.yellowAccum >= YELLOW_LIMIT) {
        st.yellowAccum -= YELLOW_LIMIT;
        st.suspendedRounds += 1;
        news.push({ playerId: st.playerId, clubId: st.clubId, kind: "suspension", rounds: 1, text: "3º cartão amarelo" });
      }
      if (ms.injured && ms.injuryDays > 0) {
        st.injuryDays = Math.max(st.injuryDays, ms.injuryDays);
        news.push({ playerId: st.playerId, clubId: st.clubId, kind: "injury", days: ms.injuryDays });
      }
      st.morale += ms.rating >= 7.5 ? 3 : ms.rating <= 5.5 ? -3 : 0;
    } else if (isAvailable(st)) {
      st.morale -= 1.5;
    }
    if (result) st.morale += result === "W" ? 4 : result === "L" ? -4 : 0.5;
    st.morale += (60 - st.morale) * 0.08;
    st.morale = Math.max(10, Math.min(100, st.morale));

    // 2) recuperação física semanal
    const res = resistencia.get(st.playerId) ?? 60;
    st.condition = Math.min(100, st.condition + 14 + res / 10);
  }
  return news;
}

/** Evolução de fim de temporada: idade +1 e progressão conforme idade e potencial. */
export function seasonProgression(age: number, overall: number, potential: number, rand: () => number): number {
  const r = rand();
  if (age <= 21) return Math.min(Math.max(0, potential - overall), 1 + Math.floor(r * 5));
  if (age <= 24) return Math.min(Math.max(0, potential - overall), Math.floor(r * 4));
  if (age <= 29) return Math.floor(r * 4) - 1;
  if (age <= 32) return -1 - Math.floor(r * 3);
  return -2 - Math.floor(r * 4);
}

export interface StandingRow {
  clubId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: string;
}

export function applyResultToStandings(rows: Map<number, StandingRow>, home: number, away: number, hg: number, ag: number): void {
  const h = rows.get(home);
  const a = rows.get(away);
  if (!h || !a) return;
  h.played++;
  a.played++;
  h.goalsFor += hg;
  h.goalsAgainst += ag;
  a.goalsFor += ag;
  a.goalsAgainst += hg;
  const push = (r: StandingRow, c: string) => (r.form = (r.form + c).slice(-5));
  if (hg > ag) {
    h.won++;
    h.points += 3;
    a.lost++;
    push(h, "V");
    push(a, "D");
  } else if (hg < ag) {
    a.won++;
    a.points += 3;
    h.lost++;
    push(h, "D");
    push(a, "V");
  } else {
    h.drawn++;
    a.drawn++;
    h.points++;
    a.points++;
    push(h, "E");
    push(a, "E");
  }
}

export function sortStandings<T extends StandingRow>(rows: T[]): T[] {
  return [...rows].sort(
    (x, y) =>
      y.points - x.points ||
      y.won - x.won ||
      y.goalsFor - y.goalsAgainst - (x.goalsFor - x.goalsAgainst) ||
      y.goalsFor - x.goalsFor ||
      x.clubId - y.clubId,
  );
}
