import Link from "next/link";
import { Crest } from "@/components/Crest";
import { CardIcon, PageTitle } from "@/components/ui";
import { getCards, getRoundFixtures, getRoundGoals, getSeasonHistory, getStandings, getTopScorers } from "@/career/queries";
import { loadCareer } from "../data";

const TABS = [
  ["classificacao", "Classificação"],
  ["rodada", "Rodada"],
  ["artilharia", "Artilharia"],
  ["cartoes", "Cartões"],
  ["historico", "Histórico"],
] as const;

export default async function TablePage(props: PageProps<"/carreira/[id]/tabela">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const data = await loadCareer(id);
  if (!data) return null;
  const { career } = data;
  const tab = (typeof sp.aba === "string" ? sp.aba : "classificacao") as (typeof TABS)[number][0];
  const base = `/carreira/${id}/tabela`;

  return (
    <div>
      <PageTitle title="Liga" subtitle={`${data.league.name} · Temporada ${career.season}`} />
      <div className="scrollbar-thin mb-4 flex gap-1 overflow-x-auto">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`${base}?aba=${key}`}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? "bg-[var(--color-accent)] text-[#04210f]" : "bg-white/5 text-[var(--color-muted)] hover:text-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {tab === "classificacao" && <Standings careerId={id} season={career.season} userClubId={career.clubId} />}
      {tab === "rodada" && (
        <RoundResults
          careerId={id}
          season={career.season}
          userClubId={career.clubId}
          total={career.totalRounds}
          round={Number(sp.rodada) || Math.max(1, career.status === "season_over" ? career.currentRound : career.currentRound - 1)}
          base={base}
        />
      )}
      {tab === "artilharia" && <Scorers careerId={id} userClubId={career.clubId} />}
      {tab === "cartoes" && <Cards careerId={id} userClubId={career.clubId} />}
      {tab === "historico" && <History careerId={id} />}
    </div>
  );
}

async function Standings({ careerId, season, userClubId }: { careerId: string; season: number; userClubId: number }) {
  const rows = await getStandings(careerId, season);
  const n = rows.length;
  return (
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
          {rows.map((r) => (
            <tr key={r.clubId} className={`border-b border-[var(--color-line)]/50 ${r.clubId === userClubId ? "bg-[var(--color-accent)]/10" : ""}`}>
              <td className="p-2 pl-3">
                <span className={`inline-block w-6 rounded text-center text-xs font-bold ${r.position <= 4 ? "bg-sky-500/30" : r.position > n - 4 ? "bg-rose-500/30" : ""}`}>{r.position}</span>
              </td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function RoundResults({ careerId, season, userClubId, round, total, base }: { careerId: string; season: number; userClubId: number; round: number; total: number; base: string }) {
  const [fixtures, goals] = await Promise.all([getRoundFixtures(careerId, season, round), getRoundGoals(careerId, season, round)]);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={`${base}?aba=rodada&rodada=${Math.max(1, round - 1)}`} className="btn btn-ghost px-3 py-1.5 text-sm">←</Link>
        <div className="font-display text-lg font-bold uppercase">Rodada {round}</div>
        <Link href={`${base}?aba=rodada&rodada=${Math.min(total, round + 1)}`} className="btn btn-ghost px-3 py-1.5 text-sm">→</Link>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {fixtures.map((f) => {
          const evs = goals.filter((g) => g.matchId === f.matchId);
          return (
            <div key={f.id} className={`card p-3 ${f.homeClubId === userClubId || f.awayClubId === userClubId ? "ring-1 ring-[var(--color-accent)]" : ""}`}>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center justify-end gap-2 text-right text-sm">
                  <span className="truncate">{f.home.name}</span>
                  <Crest crest={f.home.crest} size={24} />
                </div>
                <div className="w-16 text-center font-display text-xl font-bold">{f.played ? `${f.homeGoals} - ${f.awayGoals}` : "×"}</div>
                <div className="flex flex-1 items-center gap-2 text-sm">
                  <Crest crest={f.away.crest} size={24} />
                  <span className="truncate">{f.away.name}</span>
                </div>
              </div>
              {evs.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-[var(--color-muted)]">
                  <div className="text-right">
                    {evs.filter((e) => e.side === "home").map((e, i) => <div key={i}>{e.type === "goal" ? "⚽" : "🟥"} {e.name} {e.minute}&apos;</div>)}
                  </div>
                  <div>
                    {evs.filter((e) => e.side === "away").map((e, i) => <div key={i}>{e.type === "goal" ? "⚽" : "🟥"} {e.name} {e.minute}&apos;</div>)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function Scorers({ careerId, userClubId }: { careerId: string; userClubId: number }) {
  const rows = await getTopScorers(careerId);
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

async function Cards({ careerId, userClubId }: { careerId: string; userClubId: number }) {
  const rows = await getCards(careerId);
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
      {rows.map(({ h, club }) => (
        <div key={h.season} className="flex items-center gap-3 p-3">
          <span className="font-display text-lg font-bold">T{h.season}</span>
          <Crest crest={club.crest} size={28} />
          <div className="flex-1">
            <div className="font-semibold">🏆 {club.name}</div>
            <div className="text-xs text-[var(--color-muted)]">Seu time: {h.userPosition}º com {h.userPoints} pts</div>
          </div>
        </div>
      ))}
    </div>
  );
}
