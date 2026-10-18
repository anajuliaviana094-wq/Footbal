"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatchPayload, PayloadPlayer, PayloadTeam } from "@/career/match";
import { FORMATIONS, type MatchEvent, type Side, type Tactics } from "@/engine/types";
import { formatMinute, ratingColor } from "@/lib/format";
import { Crest } from "../Crest";
import dynamic from "next/dynamic";
import { PitchCanvas, type PitchTeam } from "./PitchCanvas";

// o 3D (three.js) só é baixado quando usado
const Pitch3D = dynamic(() => import("./Pitch3D"), {
  ssr: false,
  loading: () => <div className="w-full animate-pulse rounded-xl bg-[#0b1220]" style={{ aspectRatio: "1050 / 680" }} />,
});

type View = "3d" | "2d";
type Cam = "geral" | "close";
const VIEW_KEY = "prancheta:view";
const CAM_KEY = "prancheta:cam";

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

const TICKS_PER_SECOND = 2.2; // velocidade 1x (~2 min por jogo)
const SPEEDS = [1, 2, 4] as const;

type Phase = "pre" | "loading" | "playing" | "finishing" | "done";

interface PreMatchInfo {
  careerId: string;
  round: number;
  /** ex.: "Rodada 5" ou "Taça Pindorama · Semifinal" */
  label: string;
  home: { name: string; crest: PayloadTeam["crest"] };
  away: { name: string; crest: PayloadTeam["crest"] };
  hasLiveMatch: boolean;
}

export function MatchCenter({ info }: { info: PreMatchInfo }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("pre");
  const [payload, setPayload] = useState<MatchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiCount, setAiCount] = useState(0);

  const loadMatch = useCallback(async () => {
    setPhase("loading");
    setError(null);
    const res = await fetch(`/api/careers/${info.careerId}/match`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao iniciar a partida");
      setPhase("pre");
      return;
    }
    setPayload(data);
    setPhase("playing");
    // narração por IA em segundo plano — o jogo nunca espera por ela
    fetch(`/api/matches/${data.matchId}/narrate`, { method: "POST" })
      .then((r) => r.json())
      .then((d: { narrations: Record<string, string> }) => {
        const entries = Object.entries(d.narrations ?? {});
        if (!entries.length) return;
        setAiCount(entries.length);
        setPayload((p) => {
          if (!p) return p;
          const narrations = { ...p.narrations };
          for (const [k, text] of entries) narrations[k] = { text, source: "ai" };
          return { ...p, narrations };
        });
      })
      .catch(() => {});
  }, [info.careerId]);

  const simulateOnly = useCallback(async () => {
    setPhase("finishing");
    setError(null);
    const res = await fetch(`/api/careers/${info.careerId}/round`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao simular");
      setPhase("pre");
      return;
    }
    if (!data.matchId) {
      router.refresh();
      setPhase("pre");
      return;
    }
    const m = await fetch(`/api/matches/${data.matchId}`).then((r) => r.json());
    setPayload(m);
    // sem router.refresh(): a página já estaria no próximo dia e o resultado sumiria
    setPhase("done");
  }, [info.careerId, router]);

  const finishRound = useCallback(async () => {
    setPhase("finishing");
    const res = await fetch(`/api/careers/${info.careerId}/round`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao encerrar a rodada");
      setPhase("playing");
      return;
    }
    setPhase("done");
  }, [info.careerId]);

  if (phase === "pre" || phase === "loading" || (phase === "finishing" && !payload)) {
    return (
      <div className="card mx-auto max-w-2xl p-6 text-center">
        <div className="label">{info.label}</div>
        <div className="mt-4 flex items-center justify-around">
          <div className="flex w-36 flex-col items-center gap-2"><Crest crest={info.home.crest} size={72} /><b>{info.home.name}</b></div>
          <span className="font-display text-3xl font-bold text-[var(--color-muted)]">VS</span>
          <div className="flex w-36 flex-col items-center gap-2"><Crest crest={info.away.crest} size={72} /><b>{info.away.name}</b></div>
        </div>
        {error && <p className="mt-4 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button className="btn btn-primary px-6 py-3 text-lg" onClick={loadMatch} disabled={phase !== "pre"}>
            {phase === "loading" ? "Entrando em campo..." : info.hasLiveMatch ? "▶ Retomar partida" : "▶ Assistir partida"}
          </button>
          <button className="btn btn-ghost px-6 py-3" onClick={simulateOnly} disabled={phase !== "pre"}>
            {phase === "finishing" ? "Simulando..." : "⏩ Só o resultado"}
          </button>
        </div>
        <Link href={`/carreira/${info.careerId}/tatica`} className="mt-4 inline-block text-sm text-[var(--color-muted)] underline">Revisar tática antes do jogo</Link>
      </div>
    );
  }

  return (
    <LivePlayback
      key={payload!.matchId}
      payload={payload!}
      setPayload={setPayload}
      phase={phase}
      error={error}
      aiCount={aiCount}
      onFinish={finishRound}
      startAtEnd={phase === "done"}
    />
  );
}

// ---------------------------------------------------------------

function LivePlayback({
  payload,
  setPayload,
  phase,
  error,
  aiCount,
  onFinish,
  startAtEnd,
}: {
  payload: MatchPayload;
  setPayload: (p: MatchPayload) => void;
  phase: Phase;
  error: string | null;
  aiCount: number;
  onFinish: () => void;
  startAtEnd: boolean;
}) {
  const tickRef = useRef(startAtEnd ? payload.finalTick : 0);
  const [tick, setTick] = useState(startAtEnd ? payload.finalTick : 0);
  const [panelTick, setPanelTick] = useState(1);
  // LivePlayback só renderiza no navegador (após carregar a partida), então dá para ler a preferência direto
  const [view, setView] = useState<View>(() => readPref(VIEW_KEY, ["3d", "2d"] as const, "3d"));
  const [cam, setCam] = useState<Cam>(() => readPref(CAM_KEY, ["geral", "close"] as const, "geral"));
  const changeView = useCallback((v: View) => {
    setView(v);
    writePref(VIEW_KEY, v);
  }, []);
  const changeCam = useCallback((c: Cam) => {
    setCam(c);
    writePref(CAM_KEY, c);
  }, []);
  const [playing, setPlaying] = useState(!startAtEnd);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [panel, setPanel] = useState(false);
  const [halftimeSeen, setHalftimeSeen] = useState(startAtEnd);
  const speedRef = useRef(speed);
  const playingRef = useRef(playing);
  const halftimeSeenRef = useRef(halftimeSeen);
  useEffect(() => {
    speedRef.current = speed;
    playingRef.current = playing;
  }, [speed, playing]);

  const ended = tick >= payload.finalTick;
  const live = payload.status === "live";

  // relógio de playback
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playingRef.current) {
        const next = Math.min(payload.finalTick, tickRef.current + dt * TICKS_PER_SECOND * speedRef.current);
        if (!halftimeSeenRef.current && next >= payload.halftimeTick) {
          tickRef.current = payload.halftimeTick;
          halftimeSeenRef.current = true;
          setHalftimeSeen(true);
          setPlaying(false);
          setPanelTick(payload.halftimeTick);
          setPanel(live);
        } else tickRef.current = next;
        const floor = Math.floor(tickRef.current);
        setTick((t) => (t !== floor ? floor : t));
        if (tickRef.current >= payload.finalTick) setPlaying(false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [payload.finalTick, payload.halftimeTick, live]);

  const userTeam = payload[payload.userSide];
  const sideName = (s: Side | null) => (s === "home" ? payload.home.shortName : s === "away" ? payload.away.shortName : "");

  // ocupantes de cada slot no tick atual (titulares + substituições)
  const occupants = useMemo(() => slotOccupants(payload, tick), [payload, tick]);
  const pastEvents = useMemo(() => payload.events.filter((e) => e.tick <= tick), [payload.events, tick]);
  const score = useMemo(() => {
    const goals = pastEvents.filter((e) => e.type === "goal");
    return [goals.filter((g) => g.side === "home").length, goals.filter((g) => g.side === "away").length];
  }, [pastEvents]);
  const lastGoal = [...pastEvents].reverse().find((e) => e.type === "goal");
  const showGoal = lastGoal && tick - lastGoal.tick < 5;

  const teams = useMemo(() => pitchTeams(payload, occupants), [payload, occupants]);
  const getTick = useCallback(() => tickRef.current, []);
  const getHighlights = useCallback(() => {
    const t = tickRef.current;
    return payload.events
      .filter((e) => e.tick <= t && t - e.tick < 6 && ["yellow", "second_yellow", "red", "injury", "goal"].includes(e.type))
      .map((e) => ({ type: e.type, playerId: e.playerId, side: e.side, age: t - e.tick }));
  }, [payload.events]);

  const feed = pastEvents.filter((e) => payload.narrations[e.key]).reverse();
  const minuteLabel = (e: MatchEvent) => formatMinute(e.minute, e.tick, payload.halftimeTick);
  const clock = ended ? "FIM" : tick === payload.halftimeTick && !playing ? "INT" : formatMinute(minuteOfTick(tick, payload.halftimeTick), tick, payload.halftimeTick);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        {/* placar */}
        <div className="card flex items-center justify-between gap-2 p-3">
          <TeamHead team={payload.home} />
          <div className="text-center">
            <div className="font-display text-4xl font-bold tabular-nums">{score[0]} - {score[1]}</div>
            <div className={`mt-0.5 inline-block rounded px-2 text-xs font-bold ${ended ? "bg-white/10" : "bg-rose-500 text-white"}`}>{clock}</div>
          </div>
          <TeamHead team={payload.away} right />
        </div>

        {/* campo */}
        <div className="relative">
          {view === "3d" ? (
            <Pitch3D
              frames={payload.frames}
              getTick={getTick}
              home={teams.home}
              away={teams.away}
              getHighlights={getHighlights}
              camera={cam}
              onUnsupported={() => changeView("2d")}
            />
          ) : (
            <PitchCanvas frames={payload.frames} getTick={getTick} home={teams.home} away={teams.away} getHighlights={getHighlights} />
          )}
          <div className="absolute right-2 top-2 flex gap-1">
            <div className="flex rounded-lg bg-black/60 p-0.5 text-xs font-bold backdrop-blur">
              {(["3d", "2d"] as const).map((v) => (
                <button key={v} onClick={() => changeView(v)} className={`rounded-md px-2.5 py-1 ${view === v ? "bg-[var(--color-accent)] text-[#04210f]" : "text-white/70"}`}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
            {view === "3d" && (
              <div className="flex rounded-lg bg-black/60 p-0.5 text-xs font-bold backdrop-blur">
                {(["geral", "close"] as const).map((c) => (
                  <button key={c} onClick={() => changeCam(c)} className={`rounded-md px-2.5 py-1 capitalize ${cam === c ? "bg-white text-black" : "text-white/70"}`}>
                    {c === "geral" ? "Geral" : "Close"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {showGoal && lastGoal && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="animate-pop rounded-2xl bg-black/70 px-8 py-4 text-center">
                <div className="font-display text-5xl font-bold text-[var(--color-accent-2)] sm:text-7xl">GOOOL!</div>
                <div className="font-semibold">{lastGoal.playerName} · {sideName(lastGoal.side)}</div>
              </div>
            </div>
          )}
          {!playing && !ended && tick === payload.halftimeTick && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1 text-sm font-bold">INTERVALO</div>
          )}
        </div>

        {/* controles */}
        <div className="card flex flex-wrap items-center gap-2 p-2">
          <button className="btn btn-ghost px-4" onClick={() => setPlaying((p) => !p)} disabled={ended}>
            {playing ? "❚❚ Pausar" : "▶ Continuar"}
          </button>
          <div className="flex rounded-xl bg-white/5 p-0.5">
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${speed === s ? "bg-[var(--color-accent)] text-[#04210f]" : "text-[var(--color-muted)]"}`}>{s}x</button>
            ))}
          </div>
          {live && !ended && (
            <button
              className="btn btn-ghost px-4"
              onClick={() => {
                setPlaying(false);
                setPanelTick(Math.max(1, Math.ceil(tickRef.current)));
                setPanel(true);
              }}
            >
              ⇄ Mexer no time
            </button>
          )}
          <button
            className="btn btn-ghost ml-auto px-4"
            onClick={() => {
              tickRef.current = payload.finalTick;
              halftimeSeenRef.current = true;
              setTick(payload.finalTick);
              setPlaying(false);
              setPanel(false);
            }}
            disabled={ended}
          >
            ⏭ Fim
          </button>
        </div>

        {panel && live && !ended && (
          <ChangePanel
            payload={payload}
            team={userTeam}
            occupants={occupants[payload.userSide]}
            tick={panelTick}
            onClose={() => {
              setPanel(false);
              setPlaying(true);
            }}
            onApplied={(p) => {
              setPayload(p);
              setPanel(false);
              setPlaying(true);
            }}
          />
        )}

        {ended && (
          <EndPanel payload={payload} phase={phase} error={error} onFinish={onFinish} />
        )}
      </div>

      {/* narração */}
      <div className="card flex max-h-[70vh] flex-col xl:max-h-[calc(100dvh-140px)]">
        <div className="label flex items-center justify-between border-b border-[var(--color-line)] p-3">
          <span>Narração</span>
          {aiCount > 0 && <span className="rounded bg-[var(--color-accent)]/15 px-1.5 text-[10px] text-[var(--color-accent)]">IA</span>}
        </div>
        <ul className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-2">
          {feed.map((e) => {
            const n = payload.narrations[e.key];
            const strong = e.type === "goal" || e.type === "red" || e.type === "second_yellow";
            return (
              <li key={e.key} className={`flex gap-2 rounded-lg px-2 py-1.5 text-sm ${strong ? "bg-[var(--color-accent-2)]/10" : ""}`}>
                <span className="w-11 shrink-0 font-mono text-xs text-[var(--color-muted)]">{e.type === "kickoff" ? "0'" : minuteLabel(e)}</span>
                <span className="w-4 shrink-0">{eventIcon(e)}</span>
                <span className={strong ? "font-semibold" : ""}>{n.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function TeamHead({ team, right = false }: { team: PayloadTeam; right?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
      <Crest crest={team.crest} size={40} />
      <div className="min-w-0">
        <div className="hidden truncate font-semibold sm:block">{team.name}</div>
        <div className="font-display text-lg font-bold sm:hidden">{team.shortName}</div>
        <div className="text-xs text-[var(--color-muted)]">{team.formation}</div>
      </div>
    </div>
  );
}

function EndPanel({ payload, phase, error, onFinish }: { payload: MatchPayload; phase: Phase; error: string | null; onFinish: () => void }) {
  const s = payload.stats;
  const rows: [string, number, number][] = [
    ["Posse (%)", s.home.possession, s.away.possession],
    ["Finalizações", s.home.shots, s.away.shots],
    ["No gol", s.home.shotsOnTarget, s.away.shotsOnTarget],
    ["Escanteios", s.home.corners, s.away.corners],
    ["Faltas", s.home.fouls, s.away.fouls],
    ["Amarelos", s.home.yellows, s.away.yellows],
    ["Vermelhos", s.home.reds, s.away.reds],
  ];
  const all = [...payload.home.starters, ...payload.home.bench, ...payload.away.starters, ...payload.away.bench];
  const best = all
    .filter((p) => payload.ratings[p.id] !== undefined)
    .sort((a, b) => payload.ratings[b.id] - payload.ratings[a.id])
    .slice(0, 3);
  return (
    <div className="card space-y-4 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="label mb-2">Estatísticas</div>
          {rows.map(([l, h, a]) => (
            <div key={l} className="mb-1.5">
              <div className="flex justify-between text-sm"><b>{h}</b><span className="text-[var(--color-muted)]">{l}</span><b>{a}</b></div>
              <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                <div style={{ flex: h || 0.001, background: payload.home.primaryColor }} />
                <div style={{ flex: a || 0.001, background: payload.away.primaryColor }} />
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="label mb-2">Destaques</div>
          {best.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-1 text-sm">
              <span>{p.name}</span>
              <b className={ratingColor(payload.ratings[p.id])}>{payload.ratings[p.id].toFixed(1)}</b>
            </div>
          ))}
        </div>
      </div>
      {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
      {payload.status === "live" && phase !== "done" ? (
        <button className="btn btn-primary w-full py-3 text-lg" onClick={onFinish} disabled={phase === "finishing"}>
          {phase === "finishing" ? "Processando a rodada..." : "Encerrar rodada e ver resultados"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/carreira/${payload.careerId}/tabela?aba=rodada&rodada=${payload.round}`} className="btn btn-primary flex-1">Resultados da rodada</Link>
          <Link href={`/carreira/${payload.careerId}`} className="btn btn-ghost flex-1">Voltar ao painel</Link>
        </div>
      )}
    </div>
  );
}

function ChangePanel({
  payload,
  team,
  occupants,
  tick,
  onClose,
  onApplied,
}: {
  payload: MatchPayload;
  team: PayloadTeam;
  occupants: (number | null)[];
  tick: number;
  onClose: () => void;
  onApplied: (p: MatchPayload) => void;
}) {
  const past = payload.events.filter((e) => e.tick < tick);
  const side = payload.userSide;
  const subsUsed = past.filter((e) => e.type === "sub" && e.side === side).length;
  const usedIds = new Set(past.filter((e) => e.type === "sub" && e.side === side).flatMap((e) => [e.playerId!, e.otherId!]));
  const sentOff = new Set(past.filter((e) => (e.type === "red" || e.type === "second_yellow") && e.side === side).map((e) => e.playerId));
  const yellow = new Set(past.filter((e) => e.type === "yellow" && e.side === side).map((e) => e.playerId));
  const injured = new Set(past.filter((e) => e.type === "injury" && e.side === side).map((e) => e.playerId));
  const all = new Map([...team.starters, ...team.bench].map((p) => [p.id, p]));
  const onPitch = occupants.filter((id): id is number => id !== null && !sentOff.has(id)).map((id) => all.get(id)!).filter(Boolean);
  const bench = team.bench.filter((p) => !usedIds.has(p.id) && !occupants.includes(p.id));

  const lastTactics = useMemo(() => {
    let t: Tactics = { ...(team.tactics as Tactics) };
    for (const c of payload.changes) if (c.side === side && c.tactics) t = { ...t, ...c.tactics };
    return t;
  }, [payload.changes, side, team.tactics]);
  const [tactics, setTactics] = useState<Tactics>(lastTactics);
  const [subs, setSubs] = useState<{ outId: number; inId: number }[]>([]);
  const [outSel, setOutSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const remaining = 5 - subsUsed - subs.length;

  async function apply() {
    setBusy(true);
    setErr(null);
    const tacticsChanged = JSON.stringify(tactics) !== JSON.stringify(lastTactics);
    const res = await fetch(`/api/matches/${payload.matchId}/change`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tick, subs: subs.length ? subs : undefined, tactics: tacticsChanged ? tactics : undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "Erro");
    onApplied(data);
  }

  const pending = new Set(subs.flatMap((s) => [s.outId, s.inId]));
  return (
    <div className="card space-y-3 border-[var(--color-accent)]/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg font-bold uppercase">Mexer no time</div>
        <span className="text-xs text-[var(--color-muted)]">Substituições restantes: {remaining}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="label mb-1">1. Quem sai</div>
          <div className="grid gap-1">
            {onPitch.map((p) => (
              <PickRow
                key={p.id}
                p={p}
                rating={payload.ratings[p.id]}
                active={outSel === p.id}
                disabled={pending.has(p.id) || remaining <= 0}
                badge={injured.has(p.id) ? "🩹" : yellow.has(p.id) ? "🟨" : ""}
                onClick={() => setOutSel(outSel === p.id ? null : p.id)}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-1">2. Quem entra</div>
          <div className="grid gap-1">
            {bench.map((p) => (
              <PickRow
                key={p.id}
                p={p}
                disabled={!outSel || pending.has(p.id)}
                onClick={() => {
                  if (!outSel) return;
                  setSubs([...subs, { outId: outSel, inId: p.id }]);
                  setOutSel(null);
                }}
              />
            ))}
            {bench.length === 0 && <p className="text-sm text-[var(--color-muted)]">Sem reservas disponíveis.</p>}
          </div>
        </div>
      </div>
      {subs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subs.map((s, i) => (
            <button key={i} onClick={() => setSubs(subs.filter((_, j) => j !== i))} className="rounded-full bg-white/10 px-3 py-1 text-xs">
              ⬆ {all.get(s.inId)?.name} ⬇ {all.get(s.outId)?.name} ✕
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Seg label="Formação" value={tactics.formation} opts={FORMATIONS.map((f) => [f, f])} onChange={(v) => setTactics({ ...tactics, formation: v as Tactics["formation"] })} />
        <Seg label="Estilo" value={tactics.style} opts={[["defensivo", "Def"], ["equilibrado", "Equ"], ["ofensivo", "Ofe"]]} onChange={(v) => setTactics({ ...tactics, style: v as Tactics["style"] })} />
        <Seg label="Pressão" value={tactics.pressing} opts={[["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"]]} onChange={(v) => setTactics({ ...tactics, pressing: v as Tactics["pressing"] })} />
        <Seg label="Marcação" value={tactics.marking} opts={[["zona", "Zona"], ["individual", "Indiv."]]} onChange={(v) => setTactics({ ...tactics, marking: v as Tactics["marking"] })} />
      </div>
      {err && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-ghost flex-1" onClick={onClose}>Voltar ao jogo</button>
        <button className="btn btn-primary flex-1" onClick={apply} disabled={busy}>{busy ? "Aplicando..." : "Confirmar mudanças"}</button>
      </div>
    </div>
  );
}

function PickRow({ p, active, disabled, badge, rating, onClick }: { p: PayloadPlayer; active?: boolean; disabled?: boolean; badge?: string; rating?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${active ? "bg-yellow-300/15 ring-1 ring-yellow-300" : "bg-white/[0.03] hover:bg-white/[0.07]"} disabled:opacity-40`}
    >
      <span className="w-6 font-mono text-xs text-[var(--color-muted)]">{p.shirt}</span>
      <span className="w-8 text-[10px] font-bold text-[var(--color-muted)]">{p.position}</span>
      <span className="flex-1 truncate">{p.name}</span>
      {badge}
      {rating !== undefined && <span className={`text-xs font-bold ${ratingColor(rating)}`}>{rating.toFixed(1)}</span>}
    </button>
  );
}

function Seg({ label, value, opts, onChange }: { label: string; value: string; opts: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {opts.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)} className={`rounded-md px-2 py-1 text-xs font-semibold ${value === v ? "bg-[var(--color-accent)] text-[#04210f]" : "bg-white/5 text-[var(--color-muted)]"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// ---------- helpers ----------

function minuteOfTick(t: number, halftimeTick: number): number {
  return t < halftimeTick ? Math.floor(t / 3) + 1 : 45 + Math.floor((t - halftimeTick) / 3) + 1;
}

function slotOccupants(payload: MatchPayload, tick: number): Record<Side, (number | null)[]> {
  const occ: Record<Side, (number | null)[]> = {
    home: payload.home.starters.map((p) => p.id),
    away: payload.away.starters.map((p) => p.id),
  };
  for (const e of payload.events) {
    if (e.tick > tick) break;
    if (e.type === "sub" && e.side && typeof e.detail?.slot === "number") occ[e.side][e.detail.slot] = e.playerId ?? null;
  }
  return occ;
}

function pitchTeams(payload: MatchPayload, occ: Record<Side, (number | null)[]>): { home: PitchTeam; away: PitchTeam } {
  const all = [...payload.home.starters, ...payload.home.bench, ...payload.away.starters, ...payload.away.bench];
  const shirts = new Map(all.map((p) => [p.id, p.shirt]));
  const names = new Map(all.map((p) => [p.id, p.name]));
  const clash = colorDistance(payload.home.primaryColor, payload.away.primaryColor) < 120;
  return {
    home: {
      fill: payload.home.primaryColor,
      stroke: payload.home.secondaryColor,
      ids: occ.home,
      shirts: occ.home.map((id) => (id ? shirts.get(id) ?? null : null)),
      names: occ.home.map((id) => (id ? names.get(id) ?? null : null)),
    },
    away: {
      fill: clash ? payload.away.secondaryColor : payload.away.primaryColor,
      stroke: clash ? payload.away.primaryColor : payload.away.secondaryColor,
      ids: occ.away,
      shirts: occ.away.map((id) => (id ? shirts.get(id) ?? null : null)),
      names: occ.away.map((id) => (id ? names.get(id) ?? null : null)),
    },
  };
}

function colorDistance(a: string, b: string) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const dr = ((pa >> 16) & 255) - ((pb >> 16) & 255);
  const dg = ((pa >> 8) & 255) - ((pb >> 8) & 255);
  const db = (pa & 255) - (pb & 255);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function eventIcon(e: MatchEvent): string {
  switch (e.type) {
    case "goal": return "⚽";
    case "yellow": return "🟨";
    case "second_yellow":
    case "red": return "🟥";
    case "injury": return "🩹";
    case "sub": return "🔄";
    case "save": return "🧤";
    case "penalty": return "❗";
    case "halftime":
    case "fulltime":
    case "kickoff": return "⏱";
    case "tactic": return "📋";
    default: return "·";
  }
}

/** Replay de uma partida já disputada (inclusive da liga com amigos). */
export function MatchReplay({ matchId }: { matchId: number }) {
  const [payload, setPayload] = useState<MatchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/matches/${matchId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!alive) return;
        if (r.ok) setPayload(d);
        else setError(d.error ?? "Erro ao carregar o replay");
      })
      .catch(() => alive && setError("Erro ao carregar o replay"));
    return () => {
      alive = false;
    };
  }, [matchId]);
  if (error) return <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-rose-200">{error}</p>;
  if (!payload) return <div className="card h-64 animate-pulse" />;
  return <LivePlayback payload={payload} setPayload={setPayload} phase="done" error={null} aiCount={0} onFinish={() => {}} startAtEnd={false} />;
}
