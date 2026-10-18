import { overallColor } from "@/lib/format";

export function OverallBadge({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 text-sm font-black tabular-nums ${overallColor(value)} ${className}`}>
      {value}
    </span>
  );
}

export function PosBadge({ pos }: { pos: string }) {
  const color: Record<string, string> = {
    GOL: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    ZAG: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    LAT: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    VOL: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    MC: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    MEI: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    PON: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    ATA: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  return (
    <span className={`inline-flex w-10 justify-center rounded border px-1 py-0.5 text-[10px] font-bold ${color[pos] ?? ""}`}>{pos}</span>
  );
}

export function Bar({ value, max = 100, tone = "accent" }: { value: number; max?: number; tone?: "accent" | "gold" | "danger" | "auto" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const auto = value >= 75 ? "bg-emerald-400" : value >= 60 ? "bg-lime-400" : value >= 45 ? "bg-amber-400" : "bg-rose-400";
  const cls = tone === "auto" ? auto : tone === "gold" ? "bg-[var(--color-accent-2)]" : tone === "danger" ? "bg-[var(--color-danger)]" : "bg-[var(--color-accent)]";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CardIcon({ color, count }: { color: "yellow" | "red"; count?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className={`inline-block h-3.5 w-2.5 rounded-[2px] ${color === "yellow" ? "bg-yellow-300" : "bg-red-500"}`} />
      {count && count > 1 ? <span className="text-[10px] text-[var(--color-muted)]">{count}</span> : null}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="label">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {sub ? <div className="text-xs text-[var(--color-muted)]">{sub}</div> : null}
    </div>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">{title}</h1>
        {subtitle ? <div className="text-sm text-[var(--color-muted)]">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}
