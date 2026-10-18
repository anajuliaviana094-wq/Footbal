"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { forceRoundAction, readyAction } from "./actions";

interface Member {
  name: string;
  club: string;
  ready: boolean;
  me: boolean;
}

interface Props {
  careerId: string;
  isHost: boolean;
  meReady: boolean;
  members: Member[];
  /** dia de jogo atual (muda quando alguém processa) */
  day: number;
  dayLabel: string;
  lastResult: { day: number; matchId: number | null; text: string } | null;
}

/** Liga com amigos: quem está pronto, processamento do dia e último resultado. */
export function ReadyPanel({ careerId, isHost, meReady, members, day, dayLabel, lastResult }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const seenDay = useRef(day);
  const all = members.every((m) => m.ready);

  // atualiza sozinho para ver quando os outros marcam pronto ou o dia é processado
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [router]);

  useEffect(() => {
    if (day !== seenDay.current) {
      setMsg(`O dia ${seenDay.current} foi processado! Confira o resultado abaixo.`);
      seenDay.current = day;
    }
  }, [day]);

  const afterProcess = (processedDay?: number) => {
    if (processedDay) router.push(`/carreira/${careerId}/tabela?aba=rodada&dia=${processedDay}`);
  };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="label">👥 Dia de jogo com amigos</div>
          <div className="text-sm font-semibold">{dayLabel} · dia {day}</div>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn ${meReady ? "btn-ghost" : "btn-primary"} px-4 py-2 text-sm`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await readyAction(careerId, !meReady);
                setMsg(r.message ?? r.error ?? null);
                afterProcess(r.processedDay);
              })
            }
          >
            {pending ? "Processando..." : meReady ? "Desmarcar pronto" : all || members.filter((m) => !m.ready).length === 1 ? "✓ Estou pronto (processa o dia)" : "✓ Estou pronto"}
          </button>
          {isHost && !all && (
            <button
              className="btn btn-ghost px-4 py-2 text-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await forceRoundAction(careerId);
                  setMsg(r.message ?? r.error ?? null);
                  afterProcess(r.processedDay);
                })
              }
            >
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
      {msg && <p className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{msg}</p>}
      {lastResult && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
          <span className="text-[var(--color-muted)]">Último jogo (dia {lastResult.day}):</span>
          <b>{lastResult.text}</b>
          <span className="ml-auto flex gap-3">
            <Link href={`/carreira/${careerId}/tabela?aba=rodada&dia=${lastResult.day}`} className="text-[var(--color-accent)] underline">resultados do dia</Link>
            {lastResult.matchId && <Link href={`/carreira/${careerId}/partida/${lastResult.matchId}`} className="text-[var(--color-accent)] underline">ver replay</Link>}
          </span>
        </div>
      )}
      <p className="mt-2 text-xs text-[var(--color-muted)]">
        O dia é processado automaticamente quando o último técnico marca pronto{isHost ? " — ou quando você, anfitrião, clica em Processar agora" : ""}. Depois disso todos voltam para “aguardando” no dia seguinte.
      </p>
    </div>
  );
}
