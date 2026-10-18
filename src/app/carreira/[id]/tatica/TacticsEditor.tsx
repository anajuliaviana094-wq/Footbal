"use client";

import { useMemo, useState, useTransition } from "react";
import { FORMATION_SLOTS, positionFit } from "@/engine/formations";
import { pickBestXI } from "@/engine/lineup";
import { computeOverall } from "@/engine/ratings";
import { FORMATIONS, type EnginePlayer, type Formation, type Marking, type Pressing, type Style, type Tactics } from "@/engine/types";
import type { SquadPlayer } from "@/career/squad";
import { OverallBadge, PosBadge } from "@/components/ui";
import { saveTacticsAction } from "../actions";

const N_START = 11;
const N_BENCH = 9;

function toEngine(p: SquadPlayer): EnginePlayer {
  return { id: p.id, name: p.name, shirt: p.shirt, position: p.position, attrs: p.attrs, traits: p.traits, condition: p.condition, morale: p.morale };
}

export function TacticsEditor({
  careerId,
  squad,
  tactics: initialTactics,
  lineup,
  color,
}: {
  careerId: string;
  squad: SquadPlayer[];
  tactics: Tactics;
  lineup: { starters: number[]; bench: number[] };
  color: string;
}) {
  const byId = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);
  const [tactics, setTactics] = useState<Tactics>(initialTactics);
  const [order, setOrder] = useState<number[]>(() => {
    const starters = lineup.starters.filter((id) => byId.has(id));
    const bench = lineup.bench.filter((id) => byId.has(id) && !starters.includes(id));
    const rest = squad.map((p) => p.id).filter((id) => !starters.includes(id) && !bench.includes(id));
    return [...starters, ...bench, ...rest];
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const slots = FORMATION_SLOTS[tactics.formation];

  function swap(a: number, b: number) {
    if (a === b) return;
    setOrder((o) => {
      const n = [...o];
      [n[a], n[b]] = [n[b], n[a]];
      return n;
    });
    setMsg(null);
  }

  function tap(index: number) {
    if (selected === null) setSelected(index);
    else {
      swap(selected, index);
      setSelected(null);
    }
  }

  function auto() {
    const available = squad.filter((p) => p.available).map(toEngine);
    const best = pickBestXI(available, tactics.formation, N_BENCH);
    const starters = best.starters.map((p) => p.id);
    const bench = best.bench.map((p) => p.id);
    const rest = squad.map((p) => p.id).filter((id) => !starters.includes(id) && !bench.includes(id));
    setOrder([...starters, ...bench, ...rest]);
    setSelected(null);
  }

  function save() {
    start(async () => {
      const res = await saveTacticsAction(careerId, tactics, { starters: order.slice(0, N_START), bench: order.slice(N_START, N_START + N_BENCH) });
      setMsg(res.ok ? { ok: true, text: "Tática salva!" } : { ok: false, text: res.error ?? "Erro ao salvar" });
    });
  }

  const dnd = (index: number) => ({
    draggable: true,
    onDragStart: () => setDragFrom(index),
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: () => {
      if (dragFrom !== null) swap(dragFrom, index);
      setDragFrom(null);
      setSelected(null);
    },
  });

  const starterIds = order.slice(0, N_START);
  const avgOverall = Math.round(
    starterIds.reduce((s, id, i) => {
      const p = byId.get(id)!;
      return s + computeOverall(p.attrs, slots[i].role) * positionFit(p.position, slots[i].role);
    }, 0) / N_START,
  );
  const problems = starterIds.filter((id) => !byId.get(id)!.available).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        <div className="card space-y-3 p-4">
          <Segment label="Formação" value={tactics.formation} options={FORMATIONS.map((f) => [f, f])} onChange={(v) => setTactics({ ...tactics, formation: v as Formation })} />
          <Segment label="Estilo" value={tactics.style} options={[["defensivo", "Defensivo"], ["equilibrado", "Equilibrado"], ["ofensivo", "Ofensivo"]]} onChange={(v) => setTactics({ ...tactics, style: v as Style })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Segment label="Pressão" value={tactics.pressing} options={[["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"]]} onChange={(v) => setTactics({ ...tactics, pressing: v as Pressing })} />
            <Segment label="Marcação" value={tactics.marking} options={[["zona", "Zona"], ["individual", "Individual"]]} onChange={(v) => setTactics({ ...tactics, marking: v as Marking })} />
          </div>
        </div>

        {/* campo vertical */}
        <div className="card p-3">
          <div className="relative mx-auto aspect-[3/4] max-h-[70vh] w-full max-w-md overflow-hidden rounded-xl bg-gradient-to-b from-emerald-800 to-emerald-900">
            <PitchLines />
            {slots.map((slot, i) => {
              const p = byId.get(order[i]);
              if (!p) return null;
              const fit = positionFit(p.position, slot.role);
              return (
                <button
                  key={i}
                  {...dnd(i)}
                  onClick={() => tap(i)}
                  className={`absolute flex w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${selected === i ? "scale-110" : ""} transition`}
                  style={{ left: `${slot.y * 100}%`, top: `${(1 - slot.x) * 92 + 2}%` }}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black shadow-lg ${selected === i ? "border-yellow-300 ring-4 ring-yellow-300/40" : fit < 0.8 ? "border-rose-400" : fit < 1 ? "border-amber-300" : "border-white"}`}
                    style={{ background: color, color: isLight(color) ? "#000" : "#fff" }}
                  >
                    {p.shirt}
                  </span>
                  <span className="max-w-full truncate rounded bg-black/60 px-1 text-[10px] font-semibold leading-tight">
                    {!p.available && "⛔ "}{p.name}
                  </span>
                  <span className="text-[9px] font-bold text-white/70">{slot.role}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-[var(--color-muted)]">Força do time: <b className="text-white">{avgOverall}</b></span>
            {problems > 0 && <span className="text-rose-300">⛔ {problems} titular(es) indisponível(is) — será substituído automaticamente</span>}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={auto}>Escalação automática</button>
          <button className="btn btn-primary flex-1" onClick={save} disabled={pending}>{pending ? "Salvando..." : "Salvar"}</button>
        </div>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}`}>{msg.text}</p>}
        <PlayerList title="Reservas (banco)" indices={range(N_START, N_START + N_BENCH)} order={order} byId={byId} selected={selected} onTap={tap} dnd={dnd} />
        <PlayerList title="Não relacionados" indices={range(N_START + N_BENCH, order.length)} order={order} byId={byId} selected={selected} onTap={tap} dnd={dnd} />
      </div>
    </div>
  );
}

function range(a: number, b: number) {
  return Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
}

function PlayerList({
  title,
  indices,
  order,
  byId,
  selected,
  onTap,
  dnd,
}: {
  title: string;
  indices: number[];
  order: number[];
  byId: Map<number, SquadPlayer>;
  selected: number | null;
  onTap: (i: number) => void;
  dnd: (i: number) => object;
}) {
  return (
    <div className="card p-2">
      <div className="label px-2 py-1">{title}</div>
      {indices.map((i) => {
        const p = byId.get(order[i]);
        if (!p) return null;
        return (
          <button
            key={i}
            {...dnd(i)}
            onClick={() => onTap(i)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${selected === i ? "bg-yellow-300/15 ring-1 ring-yellow-300" : "hover:bg-white/5"}`}
          >
            <PosBadge pos={p.position} />
            <span className="flex-1 truncate">{p.name}</span>
            {!p.available && <span className="text-xs text-rose-300">{p.injuryDays > 0 ? "🩹" : "🟥"}</span>}
            <span className="w-8 text-right text-xs text-[var(--color-muted)]">{p.condition}%</span>
            <OverallBadge value={p.overall} className="h-6 min-w-8 text-xs" />
          </button>
        );
      })}
    </div>
  );
}

function Segment({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${value === v ? "bg-[var(--color-accent)] text-[#04210f]" : "bg-white/5 text-[var(--color-muted)] hover:text-white"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function PitchLines() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 75 100" preserveAspectRatio="none" aria-hidden>
      <g fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5">
        <rect x="2" y="2" width="71" height="96" />
        <line x1="2" y1="50" x2="73" y2="50" />
        <circle cx="37.5" cy="50" r="8" />
        <rect x="18" y="2" width="39" height="15" />
        <rect x="18" y="83" width="39" height="15" />
        <rect x="28" y="2" width="19" height="6" />
        <rect x="28" y="92" width="19" height="6" />
      </g>
    </svg>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
}
