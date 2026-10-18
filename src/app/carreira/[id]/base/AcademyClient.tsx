"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { OverallBadge, PosBadge } from "@/components/ui";
import { ARCHETYPE_BY_ID } from "@/seed/archetypes";
import { promoteYouthAction, releaseYouthAction, upgradeAcademyAction } from "../actions";

export function UpgradeButton({ careerId, disabled }: { careerId: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <button className="btn btn-gold mt-1" disabled={disabled || pending} onClick={() => start(async () => { const r = await upgradeAcademyAction(careerId); setMsg(r.message ?? r.error ?? null); })}>
        Investir na base
      </button>
      {msg && <p className="mt-1 text-xs">{msg}</p>}
    </div>
  );
}

interface Youth { id: number; name: string; position: string; age: number; overall: number; potential: number; archetype: string }

export function AcademyList({ careerId, players, firstTeam }: { careerId: string; players: Youth[]; firstTeam: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!players.length) return <p className="text-[var(--color-muted)]">Nenhum garoto na base agora. Uma nova leva chega no início da próxima temporada.</p>;
  return (
    <div className="card divide-y divide-[var(--color-line)]/60">
      <div className="label p-3">{players.length} garotos · elenco principal com {firstTeam} jogadores</div>
      {players.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
          <OverallBadge value={p.overall} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PosBadge pos={p.position} />
              <Link href={`/carreira/${careerId}/jogador/${p.id}`} className="truncate font-semibold hover:underline">{p.name}</Link>
            </div>
            <div className="text-xs text-[var(--color-muted)]">{p.age} anos · {ARCHETYPE_BY_ID.get(p.archetype)?.label} · potencial <b className="text-[var(--color-accent-2)]">{p.potential}</b></div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={() => start(async () => { const r = await promoteYouthAction(careerId, p.id); setMsg(r.message ?? r.error ?? null); })}>
              Promover
            </button>
            <button className="btn btn-ghost px-3 py-1.5 text-sm text-rose-300" disabled={pending} onClick={() => { if (confirm(`Dispensar ${p.name}?`)) start(async () => { const r = await releaseYouthAction(careerId, p.id); setMsg(r.message ?? r.error ?? null); }); }}>
              Dispensar
            </button>
          </div>
        </div>
      ))}
      {msg && <p className="p-3 text-sm text-emerald-300">{msg}</p>}
    </div>
  );
}
