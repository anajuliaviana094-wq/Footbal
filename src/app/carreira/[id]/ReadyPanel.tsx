"use client";

import { useState, useTransition } from "react";
import { forceRoundAction, readyAction } from "./actions";

interface Member {
  name: string;
  club: string;
  ready: boolean;
  me: boolean;
}

/** Liga com amigos: quem já está pronto para o dia de jogo. */
export function ReadyPanel({ careerId, isHost, meReady, members }: { careerId: string; isHost: boolean; meReady: boolean; members: Member[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const all = members.every((m) => m.ready);
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="label">👥 Dia de jogo com amigos</div>
        <div className="flex gap-2">
          <button
            className={`btn ${meReady ? "btn-ghost" : "btn-primary"} px-4 py-2 text-sm`}
            disabled={pending}
            onClick={() => start(async () => setMsg((await readyAction(careerId, !meReady)).message ?? null))}
          >
            {meReady ? "Desmarcar pronto" : "✓ Estou pronto"}
          </button>
          {isHost && !all && (
            <button className="btn btn-ghost px-4 py-2 text-sm" disabled={pending} onClick={() => start(async () => setMsg((await forceRoundAction(careerId)).message ?? null))}>
              Processar agora
            </button>
          )}
        </div>
      </div>
      <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
        {members.map((m) => (
          <li key={m.name + m.club} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5">
            <span>{m.ready ? "✅" : "⏳"}</span>
            <span className="flex-1 truncate">{m.name}{m.me && " (você)"}</span>
            <span className="truncate text-xs text-[var(--color-muted)]">{m.club}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[var(--color-muted)]">A rodada é processada quando todos marcam pronto{isHost ? " — ou quando você, anfitrião, processar." : "."} Depois, assista ao replay do seu jogo.</p>
      {msg && <p className="mt-2 text-sm text-emerald-300">{msg}</p>}
    </div>
  );
}
