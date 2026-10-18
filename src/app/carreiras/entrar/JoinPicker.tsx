"use client";

import { useActionState, useState } from "react";
import { Crest } from "@/components/Crest";
import type { CrestSpec } from "@/seed/generate";
import { joinCareerAction } from "../actions";

interface Club { id: number; name: string; leagueId: string; crest: CrestSpec; strength: number; taken: boolean }

export function JoinPicker({ code, system, season, leagues, clubs }: { code: string; system: string; season: number; leagues: { id: string; name: string; locked: boolean }[]; clubs: Club[] }) {
  const [clubId, setClubId] = useState<number | null>(null);
  const [state, action, pending] = useActionState(joinCareerAction, undefined);
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted)]">Liga de {system} · temporada {season}</p>
      {leagues.map((l) => (
        <section key={l.id}>
          <div className="label mb-2">{l.name} {l.locked && "🔒 Premium"}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {clubs
              .filter((c) => c.leagueId === l.id)
              .sort((a, b) => b.strength - a.strength)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={c.taken || l.locked}
                  onClick={() => setClubId(c.id)}
                  className={`card flex flex-col items-center gap-2 p-3 text-center text-sm disabled:opacity-40 ${clubId === c.id ? "ring-2 ring-[var(--color-accent)]" : ""}`}
                >
                  <Crest crest={c.crest} size={40} />
                  <span className="font-semibold leading-tight">{c.name}</span>
                  {c.taken && <span className="text-[10px] text-amber-300">com técnico</span>}
                </button>
              ))}
          </div>
        </section>
      ))}
      <form action={action} className="sticky bottom-4">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="clubId" value={clubId ?? ""} />
        {state?.error && <p className="mb-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{state.error}</p>}
        <button className="btn btn-primary w-full py-3 text-lg" disabled={!clubId || pending}>{pending ? "Entrando..." : "Assumir este clube"}</button>
      </form>
    </div>
  );
}
