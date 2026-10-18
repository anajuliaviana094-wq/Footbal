import Link from "next/link";
import { Crest } from "@/components/Crest";
import { Bar, Stat } from "@/components/ui";
import { getDashboard } from "@/career/queries";
import { loadCareer } from "./data";
import { newSeasonAction } from "./actions";

const NEWS_ICON: Record<string, string> = {
  result: "📣",
  suspension: "🟥",
  injury: "🩹",
  recovered: "💪",
  table: "📊",
  season: "🏆",
  welcome: "👋",
};

export default async function DashboardPage(props: PageProps<"/carreira/[id]">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const { career, club } = data;
  const d = await getDashboard(data);
  const me = d.table.find((t) => t.clubId === club.id)!;
  const next = d.nextFixtures[0];
  const opp = next ? d.clubs.get(next.homeClubId === club.id ? next.awayClubId : next.homeClubId) : null;
  const leader = d.table[0];

  return (
    <div className="space-y-4">
      {career.status === "season_over" && (
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-[var(--color-accent-2)]/25 to-transparent p-5">
            <div className="label text-[var(--color-accent-2)]">Fim da temporada {career.season}</div>
            <div className="mt-1 flex items-center gap-3">
              <Crest crest={leader.club.crest} size={56} />
              <div>
                <div className="font-display text-2xl font-bold uppercase">🏆 {leader.club.name}</div>
                <div className="text-sm text-[var(--color-muted)]">campeão com {leader.points} pontos</div>
              </div>
            </div>
            <p className="mt-3 text-sm">
              Seu time terminou em <b>{me.position}º lugar</b> com {me.points} pontos ({me.won}V {me.drawn}E {me.lost}D, saldo {me.goalsFor - me.goalsAgainst}).
            </p>
            <form action={newSeasonAction} className="mt-4">
              <input type="hidden" name="careerId" value={career.id} />
              <button className="btn btn-primary">Começar temporada {career.season + 1}</button>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* próxima partida */}
        <div className="card p-5 lg:col-span-2">
          <div className="label">Próxima partida</div>
          {next && opp ? (
            <>
              <div className="mt-3 flex items-center justify-around gap-2 text-center">
                <TeamBlock name={d.clubs.get(next.homeClubId)!.club.name} crest={d.clubs.get(next.homeClubId)!.club.crest} pos={d.clubs.get(next.homeClubId)!.position} />
                <div>
                  <div className="font-display text-3xl font-bold text-[var(--color-muted)]">VS</div>
                  <div className="text-xs text-[var(--color-muted)]">Rodada {next.round}</div>
                </div>
                <TeamBlock name={d.clubs.get(next.awayClubId)!.club.name} crest={d.clubs.get(next.awayClubId)!.club.crest} pos={d.clubs.get(next.awayClubId)!.position} />
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href={`/carreira/${id}/partida`} className="btn btn-primary px-6">▶ Jogar rodada</Link>
                <Link href={`/carreira/${id}/tatica`} className="btn btn-ghost">Ajustar tática</Link>
              </div>
            </>
          ) : (
            <p className="mt-3 text-[var(--color-muted)]">Nenhuma partida pendente nesta temporada.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Stat label="Posição" value={`${me.position}º`} sub={`${me.points} pts · ${me.played} jogos`} />
          <div className="card p-3">
            <div className="label">Moral do elenco</div>
            <div className="mt-1 font-display text-2xl font-bold">{d.morale}</div>
            <Bar value={d.morale} tone="auto" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="label mb-3">Notícias</div>
          <ul className="space-y-2">
            {d.news.map((n) => (
              <li key={n.id} className="flex gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                <span>{NEWS_ICON[n.kind] ?? "•"}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <div className="label mb-2">Últimos resultados</div>
            {d.recent.length === 0 && <p className="text-sm text-[var(--color-muted)]">Ainda sem jogos.</p>}
            <ul className="space-y-1.5 text-sm">
              {d.recent.map((f) => {
                const home = f.homeClubId === club.id;
                const gf = home ? f.homeGoals! : f.awayGoals!;
                const ga = home ? f.awayGoals! : f.homeGoals!;
                const res = gf > ga ? "V" : gf < ga ? "D" : "E";
                const o = d.clubs.get(home ? f.awayClubId : f.homeClubId)!.club;
                return (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className={`w-5 rounded text-center text-xs font-bold ${res === "V" ? "bg-emerald-500 text-black" : res === "D" ? "bg-rose-500 text-black" : "bg-slate-500 text-black"}`}>{res}</span>
                    <span className="flex-1 truncate">{home ? "vs" : "@"} {o.name}</span>
                    <span className="font-mono">{gf}-{ga}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card p-5">
            <div className="label mb-2">Desfalques</div>
            {d.unavailable.length === 0 && d.hanging.length === 0 && <p className="text-sm text-[var(--color-muted)]">Elenco completo.</p>}
            <ul className="space-y-1 text-sm">
              {d.unavailable.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <Link href={`/carreira/${id}/jogador/${p.id}`} className="hover:underline">{p.name}</Link>
                  <span className="text-[var(--color-muted)]">
                    {p.injuryDays > 0 ? `🩹 ${p.injuryDays} dias` : `🟥 ${p.suspendedRounds} jogo(s)`}
                  </span>
                </li>
              ))}
              {d.hanging.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="text-yellow-300">pendurado (2 🟨)</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamBlock({ name, crest, pos }: { name: string; crest: Parameters<typeof Crest>[0]["crest"]; pos: number }) {
  return (
    <div className="flex w-32 flex-col items-center gap-2 sm:w-44">
      <Crest crest={crest} size={64} />
      <div className="text-sm font-bold leading-tight">{name}</div>
      <div className="text-xs text-[var(--color-muted)]">{pos}º lugar</div>
    </div>
  );
}
