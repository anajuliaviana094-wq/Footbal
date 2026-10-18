"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Crest } from "@/components/Crest";
import type { CrestSpec } from "@/seed/generate";
import { createCareerAction } from "../actions";

interface League { id: string; name: string; flag: string; inspiration: string; level: number; isFree: boolean; locked: boolean }
interface Club { id: number; leagueId: string; name: string; city: string; strength: number; crest: CrestSpec; primaryColor: string }

function Stars({ value }: { value: number }) {
  return (
    <span className="text-[var(--color-accent-2)]" aria-label={`${value} de 5`}>
      {"★".repeat(value)}<span className="text-white/15">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function NewCareerPicker({ leagues, clubs }: { leagues: League[]; clubs: Club[] }) {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [clubId, setClubId] = useState<number | null>(null);
  const [state, action, pending] = useActionState(createCareerAction, undefined);
  const leagueClubs = useMemo(() => clubs.filter((c) => c.leagueId === leagueId).sort((a, b) => b.strength - a.strength), [clubs, leagueId]);
  const [min, max] = leagueClubs.length ? [leagueClubs.at(-1)!.strength, leagueClubs[0].strength] : [0, 1];
  const stars = (s: number) => 1 + Math.round(((s - min) / Math.max(1, max - min)) * 4);

  return (
    <div className="space-y-6">
      <section>
        <div className="label mb-2">1. Liga</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {leagues.map((l) => {
            const selected = l.id === leagueId;
            const body = (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{l.flag}</span>
                  {l.locked ? (
                    <span className="rounded-full bg-[var(--color-accent-2)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent-2)]">🔒 PREMIUM</span>
                  ) : l.isFree ? (
                    <span className="rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">GRÁTIS</span>
                  ) : null}
                </div>
                <div className="mt-2 font-display text-lg font-bold uppercase leading-tight">{l.name}</div>
                <div className="text-xs text-[var(--color-muted)]">Inspirada em: {l.inspiration}</div>
                <div className="mt-2 text-xs text-[var(--color-muted)]">Nível médio {l.level}</div>
              </>
            );
            return l.locked ? (
              <Link key={l.id} href="/planos" className="card block p-4 opacity-60 transition hover:opacity-90">
                {body}
              </Link>
            ) : (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setLeagueId(l.id);
                  setClubId(null);
                }}
                className={`card p-4 text-left transition ${selected ? "ring-2 ring-[var(--color-accent)]" : "hover:border-white/30"}`}
              >
                {body}
              </button>
            );
          })}
        </div>
      </section>

      {leagueId && (
        <section>
          <div className="label mb-2">2. Clube</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {leagueClubs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClubId(c.id)}
                className={`card flex flex-col items-center gap-2 p-3 text-center transition ${clubId === c.id ? "ring-2 ring-[var(--color-accent)]" : "hover:border-white/30"}`}
              >
                <Crest crest={c.crest} size={48} />
                <div className="text-sm font-semibold leading-tight">{c.name}</div>
                <Stars value={stars(c.strength)} />
              </button>
            ))}
          </div>
        </section>
      )}

      <form action={action} className="sticky bottom-4 z-10">
        <input type="hidden" name="leagueId" value={leagueId ?? ""} />
        <input type="hidden" name="clubId" value={clubId ?? ""} />
        {state?.error && <p className="mb-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{state.error}</p>}
        <button className="btn btn-primary w-full py-3 text-lg" disabled={!clubId || pending}>
          {pending ? "Preparando a temporada..." : clubId ? `Assumir o ${leagueClubs.find((c) => c.id === clubId)?.name}` : "Escolha um clube"}
        </button>
      </form>
    </div>
  );
}
