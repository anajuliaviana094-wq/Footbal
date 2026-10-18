"use client";

import { useState, useTransition } from "react";
import { respondOfferAction } from "../actions";

export function OfferButtons({ careerId, offerId }: { careerId: string; offerId: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const respond = (accept: boolean) =>
    start(async () => {
      const r = await respondOfferAction(careerId, offerId, accept);
      setMsg(r.message ?? r.error ?? null);
    });
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1 py-1.5 text-sm" disabled={pending} onClick={() => respond(true)}>Aceitar</button>
        <button className="btn btn-ghost flex-1 py-1.5 text-sm" disabled={pending} onClick={() => respond(false)}>Recusar</button>
      </div>
      {msg && <p className="mt-1 text-xs">{msg}</p>}
    </div>
  );
}
