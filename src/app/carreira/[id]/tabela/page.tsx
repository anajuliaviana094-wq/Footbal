import Link from "next/link";
import { LEAGUE_BY_ID } from "@/data/leagues";
import { Crest } from "@/components/Crest";
import { CardIcon, PageTitle } from "@/components/ui";
import { getCards, getDayEvents, getDayFixtures, getSeasonHistory, getStandings, getTopScorers } from "@/career/queries";
import { dayLabel } from "@/lib/day";
import { loadCareer } from "../data";

const TABS = [
  ["classificacao", "Classificação"],
  ["rodada", "Jogos do dia"],
  ["artilharia", "Artilharia"],
  ["cartoes", "Cartões"],
  ["historico", "Histórico"],
] as const;

export default async function TablePage(props: PageProps<"/carreira/[id]/tabela">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const data = await loadCareer(id);
  if (!data) return null;
  const { career, system } = data;
  const tab = (typeof sp.aba === "string" ? sp.aba : "classificacao") as (typeof TABS)[number][0];
  const leagueId = typeof sp.liga === "string" && system.leagues.includes(sp.liga) ? sp.liga : data.league.id;
  const base = `/carreira/${id}/tabela`;
  const q = (extra: Record<string, string | number>) => `${base}?${new URLSearchParams({ aba: tab, liga: leagueId, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) })}`;
  const lastPlayed = career.status === "season_over" ? career.currentRound : Math.max(1, career.currentRound - 1);

  return (
    <div>
      <PageTitle title="Liga" subtitle={`${LEAGUE_BY_ID.get(leagueId)?.name} · Temporada ${career.season}`} />
      <div className="scrollbar-thin mb-3 flex gap-1 overflow-x-auto">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`${base}?aba=${key}&liga=${leagueId}`}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? "bg-[var(--color-accent)] text-[#04210f]" : "bg-white/5 text-[var(--color-muted)] hover:text-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {system.leagues.length > 1 && tab !== "historico" && tab !== "rodada" && (
        <div className="mb-4 flex gap-1">
          {system.leagues.map((lid) => (
            <Link key={lid} href={`${base}?aba=${tab}&liga=${lid}`} className={`rounded-lg px-3 py-1 text-xs font-bold ${lid === leagueId ? "bg-white text-black" : "bg-white/5 text-[var(--color-muted)]"}`}>
              {LEAGUE_BY_ID.get(lid)?.tier}ª divisão
            </Link>
          ))}
        </div>
      )}
      {tab === "classificacao" && (
        <Standings careerId={id} season={career.season} leagueId={leagueId} userClubId={data.clubId} tierIndex={system.leagues.indexOf(leagueId)} tiers={system.leagues.length} spots={system.promotionSpots} />
      )}
      {tab === "rodada" && (
        <DayResults
          careerId={id}
          season={career.season}
          userClubId={data.clubId}
          day={Math.min(career.totalRounds, Math.max(1, Number(sp.dia) || lastPlayed))}
          total={career.totalRounds}
          label={(d: number) => dayLabel(career.calendar?.[d - 1], system.cup.name, career.calendar)}
          href={(d: number) => q({ dia: d })}
        />
      )}
      {tab === "artilharia" && <Scorers careerId={id} leagueId={leagueId} userClubId={data.clubId} />}
      {tab === "cartoes" && <Cards careerId={id} leagueId={leagueId} userClubId={data.clubId} />}
      {tab === "historico" && <History careerId={id} />}
    </div>
  );
}

async function Standings({ careerId, season, leagueId, userClubId, tierIndex, tiers, spots }: { careerId: string; season: number; leagueId: string; userClubId: number; tierIndex: number; tiers: number; spots: number }) {
  const rows = await getStandings(careerId, season, leagueId);
  const n = rows.length;
  const up = tierIndex > 0 ? spots : 0;
  const down = tierIndex < tiers - 1 ? spots : 0;
  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--color-muted)]">
            <tr className="border-b border-[var(--color-line)]">
              <th className="p-2 pl-3">#</th>
              <th className="p-2">Clube</th>
              <th className="p-2 text-center">P</th>
              <th className="p-2 text-center">J</th>
              <th className="p-2 text-center">V</th>
              <th className="hidden p-2 text-center sm:table-cell">E</th>
              <th className="hidden p-2 text-center sm:table-cell">D</th>
              <th className="hidden p-2 text-center sm:table-cell">GP</th>
              <th className="hidden p-2 text-center sm:table-cell">GC</th>
              <th className="p-2 text-center">SG</th>
              <th className="hidden p-2 md:table-cell">Últimos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const zone = r.position <= up ? "bg-emerald-500/40" : r.position > n - down ? "bg-rose-500/40" : r.position === 1 ? "bg-[var(--color-accent-2)]/40" : "";
              return (
                <tr key={r.clubId} className={`border-b border-[var(--color-line)]/50 ${r.clubId === userClubId ? "bg-[var(--color-accent)]/10" : ""}`}>
                  <td className="p-2 pl-3"><span className={`inline-block w-6 rounded text-center text-xs font-bold ${zone}`}>{r.position}</span></td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Crest crest={r.club.crest} size={22} />
                      <span className={`truncate ${r.clubId === userClubId ? "font-bold" : ""}`}>{r.club.name}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center font-bold">{r.points}</td>
                  <td className="p-2 text-center">{r.played}</td>
                  <td className="p-2 text-center">{r.won}</td>
                  <td className="hidden p-2 text-center sm:table-cell">{r.drawn}</td>
                  <td className="hidden p-2 text-center sm:table-cell">{r.lost}</td>
                  <td className="hidden p-2 text-center sm:table-cell">{r.goalsFor}</td>
                  <td className="hidden p-2 text-center sm:table-cell">{r.goalsAgainst}</td>
                  <td className="p-2 text-center">{r.goalsFor - r.goalsAgainst}</td>
                  <td className="hidden p-2 md:table-cell">
                    <div className="flex gap-0.5">
                      {r.form.split("").map((c, i) => (
                        <span key={i} className={`h-4 w-4 rounded-sm text-center text-[10px] font-bold leading-4 text-black ${c === "V" ? "bg-emerald-500" : c === "D" ? "bg-rose-500" : "bg-slate-400"}`}>{c}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-[var(--color-accent-2)]/60" />Campeão</span>
        {up > 0 && <span><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-500/60" />Acesso ({up})</span>}
        {down > 0 && <span><span className="mr-1 inline-block h-3 w-3 rounded bg-rose-500/60" />Rebaixamento ({down})</span>}
      </div>
    </>
  );
}

async function DayResults({ careerId, season, userClubId, day, total, label, href }: { careerId: string; season: number; userClubId: number; day: number; total: number; label: (d: number) => string; href: (d: number) => string }) {
  const [fixtures, events] = await Promise.all([getDayFixtures(careerId, season, day), getDayEvents(careerId, season, day)]);
  const groups = new Map<string, typeof fixtures>();
  for (const f of fixtures) groups.set(f.leagueId ?? "", [...(groups.get(f.leagueId ?? "") ?? []), f]);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={href(Math.max(1, day - 1))} className="btn btn-ghost px-3 py-1.5 text-sm">←</Link>
        <div className="text-center">
          <div className="font-display text-lg font-bold uppercase">{label(day)}</div>
          <div className="text-xs text-[var(--color-muted)]">dia {day} de {total}</div>
        </div>
        <Link href={href(Math.min(total, day + 1))} className="btn btn-ghost px-3 py-1.5 text-sm">→</Link>
      </div>
      {fixtures.length === 0 && <p className="text-[var(--color-muted)]">Os jogos desta fase ainda serão sorteados.</p>}
      {[...groups.entries()].map(([lid, list]) => (
        <section key={lid} className="mb-4">
          <div className="label mb-2">{LEAGUE_BY_ID.get(lid)?.name ?? "Copa"}</div>
          <div className="grid gap-2 md:grid-cols-2">
            {list.map((f) => {
              const evs = events.filter((g) => g.matchId === f.matchId);
              const mine = f.homeClubId === userClubId || f.awayClubId === userClubId;
              return (
                <div key={f.id} className={`card min-w-0 p-3 ${mine ? "ring-1 ring-[var(--color-accent)]" : ""}`}>
                  <div className="flex items-center gap-2">
                    <div className={`flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-sm ${f.winnerClubId === f.homeClubId ? "font-bold" : ""}`}>
                      <span className="line-clamp-2 leading-tight">{f.home.name}</span>
                      <Crest crest={f.home.crest} size={24} className="shrink-0" />
                    </div>
                    <div className="w-16 shrink-0 text-center">
                      <div className="font-display text-xl font-bold">{f.played ? `${f.homeGoals} - ${f.awayGoals}` : "×"}</div>
                      {f.penalties && <div className="text-[10px] text-[var(--color-muted)]">pên. {f.penalties}</div>}
                    </div>
                    <div className={`flex min-w-0 flex-1 items-center gap-2 text-sm ${f.winnerClubId === f.awayClubId ? "font-bold" : ""}`}>
                      <Crest crest={f.away.crest} size={24} className="shrink-0" />
                      <span className="line-clamp-2 leading-tight">{f.away.name}</span>
                    </div>
                  </div>
                  {evs.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-[var(--color-muted)]">
                      <div className="text-right">{evs.filter((e) => e.side === "home").map((e, i) => <div key={i}>{e.type === "goal" ? "⚽" : "🟥"} {e.name} {e.minute}&apos;</div>)}</div>
                      <div>{evs.filter((e) => e.side === "away").map((e, i) => <div key={i}>{e.type === "goal" ? "⚽" : "🟥"} {e.name} {e.minute}&apos;</div>)}</div>
                    </div>
                  )}
                  {mine && f.matchId && (
                    <Link href={`/carreira/${careerId}/partida/${f.matchId}`} className="mt-2 block text-center text-xs text-[var(--color-accent)] underline">Ver replay</Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

async function Scorers({ careerId, leagueId, userClubId }: { careerId: string; leagueId: string; userClubId: number }) {
  const rows = await getTopScorers(careerId, leagueId);
  if (!rows.length) return <p className="text-[var(--color-muted)]">Nenhum gol marcado ainda.</p>;
  return (
    <div className="card divide-y divide-[var(--color-line)]/60">
      {rows.map((r, i) => (
        <Link key={r.playerId} href={`/carreira/${careerId}/jogador/${r.playerId}`} className={`flex items-center gap-3 p-3 hover:bg-white/[0.03] ${r.club.id === userClubId ? "bg-[var(--color-accent)]/10" : ""}`}>
          <span className="w-6 text-center font-bold text-[var(--color-muted)]">{i + 1}</span>
          <Crest crest={r.club.crest} size={26} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{r.name}</div>
            <div className="truncate text-xs text-[var(--color-muted)]">{r.club.name} · {r.appearances} jogos · {r.assists} assist.</div>
          </div>
          <span className="font-display text-2xl font-bold">{r.goals}</span>
        </Link>
      ))}
    </div>
  );
}

async function Cards({ careerId, leagueId, userClubId }: { careerId: string; leagueId: string; userClubId: number }) {
  const rows = await getCards(careerId, leagueId);
  if (!rows.length) return <p className="text-[var(--color-muted)]">Nenhum cartão ainda.</p>;
  return (
    <div className="card divide-y divide-[var(--color-line)]/60">
      {rows.map((r) => (
        <Link key={r.playerId} href={`/carreira/${careerId}/jogador/${r.playerId}`} className={`flex items-center gap-3 p-3 hover:bg-white/[0.03] ${r.club.id === userClubId ? "bg-[var(--color-accent)]/10" : ""}`}>
          <Crest crest={r.club.crest} size={26} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{r.name} {r.suspended > 0 && <span className="text-xs text-rose-300">(suspenso)</span>}</div>
            <div className="truncate text-xs text-[var(--color-muted)]">{r.club.name}</div>
          </div>
          <span className="flex items-center gap-3 font-bold">
            <span className="flex items-center gap-1"><CardIcon color="yellow" /> {r.yellows}</span>
            <span className="flex items-center gap-1"><CardIcon color="red" /> {r.reds}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

async function History({ careerId }: { careerId: string }) {
  const rows = await getSeasonHistory(careerId);
  if (!rows.length) return <p className="text-[var(--color-muted)]">Nenhuma temporada concluída ainda.</p>;
  return (
    <div className="card divide-y divide-[var(--color-line)]/60">
      {rows.map(({ h, club, promoted, relegated }) => (
        <div key={`${h.season}-${h.competitionId}`} className="flex items-start gap-3 p-3">
          <span className="font-display text-lg font-bold">T{h.season}</span>
          <Crest crest={club.crest} size={28} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">🏆 {club.name}</div>
            <div className="text-xs text-[var(--color-muted)]">{LEAGUE_BY_ID.get(h.competitionId)?.name ?? "Copa nacional"}</div>
            {promoted.length > 0 && <div className="text-xs text-emerald-300">⬆ Subiram: {promoted.join(", ")}</div>}
            {relegated.length > 0 && <div className="text-xs text-rose-300">⬇ Caíram: {relegated.join(", ")}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
