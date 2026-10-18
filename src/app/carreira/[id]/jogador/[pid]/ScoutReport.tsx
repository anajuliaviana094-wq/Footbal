"use client";

import { useEffect, useState } from "react";

export function ScoutReport({ careerId, playerId, initial }: { careerId: string; playerId: number; initial: string | null }) {
  const [text, setText] = useState<string | null>(initial);
  const [source, setSource] = useState<string>(initial ? "cache" : "");

  useEffect(() => {
    if (initial) return;
    let alive = true;
    fetch(`/api/players/${playerId}/scout?careerId=${careerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.text) {
          setText(d.text);
          setSource(d.source);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [careerId, playerId, initial]);

  return (
    <div className="card relative overflow-hidden p-5">
      <div className="absolute -right-6 -top-6 text-7xl opacity-10">🔍</div>
      <div className="label flex items-center gap-2">
        Relatório do olheiro
        {source === "ai" || source === "cache" ? <span className="rounded bg-[var(--color-accent)]/15 px-1.5 text-[10px] text-[var(--color-accent)]">IA</span> : null}
      </div>
      {text ? (
        <p className="mt-2 leading-relaxed">{text}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-white/10" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-white/10" />
          <div className="text-xs text-[var(--color-muted)]">O olheiro está analisando o jogador...</div>
        </div>
      )}
    </div>
  );
}
