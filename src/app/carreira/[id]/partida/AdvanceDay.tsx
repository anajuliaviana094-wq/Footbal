"use client";

import { useState, useTransition } from "react";
import { forceRoundAction } from "../actions";

export function AdvanceDay({ careerId }: { careerId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button className="btn btn-primary px-6" disabled={pending} onClick={() => start(async () => setMsg((await forceRoundAction(careerId)).error ?? null))}>
        {pending ? "Simulando os jogos do dia..." : "⏩ Avançar dia"}
      </button>
      {msg && <p className="text-sm text-rose-300">{msg}</p>}
    </>
  );
}
