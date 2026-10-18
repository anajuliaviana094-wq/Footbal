import type { CalendarDay } from "@/db/schema";

/**
 * Monta o calendário da temporada: as rodadas da liga com as fases da copa
 * intercaladas em intervalos regulares (a final perto do fim da temporada).
 */
export function buildCalendar(leagueRounds: number, cupStages: number): CalendarDay[] {
  const afterRound = new Map<number, number>();
  for (let s = 1; s <= cupStages; s++) {
    afterRound.set(Math.max(1, Math.round((s * leagueRounds) / (cupStages + 1))), s);
  }
  const days: CalendarDay[] = [];
  for (let r = 1; r <= leagueRounds; r++) {
    days.push({ day: days.length + 1, type: "league", round: r });
    const stage = afterRound.get(r);
    if (stage) days.push({ day: days.length + 1, type: "cup", round: stage });
  }
  return days;
}
