export function formatMoney(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(".", ",")} mi`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`;
  return `R$ ${v}`;
}

export function formatMinute(minute: number, tick: number, halftimeTick: number): string {
  if (tick < halftimeTick && minute > 45) return `45+${minute - 45}'`;
  if (tick >= halftimeTick && minute > 90) return `90+${minute - 90}'`;
  return `${minute}'`;
}

export function ratingColor(r: number): string {
  if (r >= 8) return "text-emerald-300";
  if (r >= 7) return "text-lime-300";
  if (r >= 6) return "text-amber-200";
  return "text-rose-300";
}

export function overallColor(o: number): string {
  if (o >= 80) return "bg-emerald-500 text-emerald-950";
  if (o >= 72) return "bg-lime-400 text-lime-950";
  if (o >= 64) return "bg-amber-300 text-amber-950";
  return "bg-orange-400 text-orange-950";
}
