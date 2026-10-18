import type { CalendarDay } from "@/db/schema";
import { cupStageName } from "@/career/cup";

export function dayLabel(day: CalendarDay | null | undefined, cupName: string, calendar: CalendarDay[] | null): string {
  if (!day) return "";
  if (day.type === "league") return `Rodada ${day.round}`;
  const total = calendar?.filter((d) => d.type === "cup").length ?? day.round;
  return `${cupName} · ${cupStageName(day.round, total)}`;
}
