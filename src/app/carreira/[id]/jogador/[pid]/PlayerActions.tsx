"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/format";
import { bidAction, listPlayerAction } from "../../actions";

interface Props {
  careerId: string;
  playerId: number;
  name: string;
  isMine: boolean;
  listed: boolean;
  askingPrice: number | null;
  value: number;
  wage: number;
  balance: number;
  quote: { asking: number; wage: number } | null;
}

function parseMoney(s: string): number {
  return Number(s.replace(/\D/g, "")) || 0;
}

export function PlayerActions(p: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fee, setFee] = useState(String(p.quote?.asking ?? p.askingPrice ?? p.value));
  const [wage, setWage] = useState(String(p.quote?.wage ?? p.wage));
  const [price, setPrice] = useState(String(p.askingPrice ?? p.value));

  if (p.isMine) {
    return (
      <div className="card p-5">
        <div className="label mb-2">Mercado</div>
        <p className="text-sm text-[var(--color-muted)]">
          Valor de mercado estimado: <b className="text-white">{formatMoney(p.value)}</b> · salário {formatMoney(p.wage)}/mês
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {!p.listed && (
            <label className="flex-1">
              <span className="label">Preço pedido</span>
              <input className="input mt-1" inputMode="numeric" value={Number(parseMoney(price)).toLocaleString("pt-BR")} onChange={(e) => setPrice(e.target.value)} />
            </label>
          )}
          <button
            className={`btn ${p.listed ? "btn-ghost" : "btn-gold"}`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await listPlayerAction(p.careerId, p.playerId, !p.listed, p.listed ? null : parseMoney(price));
                setMsg({ ok: r.ok, text: r.message ?? r.error ?? "" });
              })
            }
          >
            {p.listed ? "Retirar da lista de transferências" : "Colocar à venda"}
          </button>
        </div>
        {p.listed && <p className="mt-2 text-sm text-amber-300">À venda por {formatMoney(p.askingPrice ?? p.value)}. Clubes podem fazer propostas a cada dia de jogo.</p>}
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.text}</p>}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="label mb-2">Fazer proposta</div>
      <p className="text-sm text-[var(--color-muted)]">
        Valor de mercado: <b className="text-white">{formatMoney(p.value)}</b>
        {p.quote && <> · o clube deve pedir cerca de <b className="text-white">{formatMoney(p.quote.asking)}</b></>} · seu caixa: {formatMoney(p.balance)}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label>
          <span className="label">Valor da transferência (R$)</span>
          <input className="input mt-1" inputMode="numeric" value={parseMoney(fee).toLocaleString("pt-BR")} onChange={(e) => setFee(e.target.value)} />
        </label>
        <label>
          <span className="label">Salário mensal oferecido (R$)</span>
          <input className="input mt-1" inputMode="numeric" value={parseMoney(wage).toLocaleString("pt-BR")} onChange={(e) => setWage(e.target.value)} />
        </label>
        <button
          className="btn btn-primary self-end"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await bidAction(p.careerId, p.playerId, parseMoney(fee), parseMoney(wage));
              setMsg({ ok: r.ok, text: r.message ?? r.error ?? "" });
              if (r.counterFee) setFee(String(r.counterFee));
            })
          }
        >
          {pending ? "Enviando..." : "Enviar proposta"}
        </button>
      </div>
      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-200"}`}>{msg.text}</p>}
    </div>
  );
}
