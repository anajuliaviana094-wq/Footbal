import Link from "next/link";
import { Crest } from "@/components/Crest";
import { Bar, Stat } from "@/components/ui";
import { getDashboard } from "@/career/queries";
import { getMembers } from "@/career/service";
import { formatMoney } from "@/lib/format";
import { dayLabel } from "@/lib/day";
import { loadCareer } from "./data";
import { newSeasonAction } from "./actions";
import { ReadyPanel } from "./ReadyPanel";

const NEWS_ICON: Record<string, string> = {
  result: "📣",
  suspension: "🟥",
  injury: "🩹",
  recovered: "💪",
  table: "📊",
  season: "🏆",
  cup: "🏆",
  welcome: "👋",
  offer: "💰",
  transfer: "🔁",
  youth: "🌱",
};

export default async function DashboardPage(props: PageProps<"/carreira/[id]">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const { career, club, system } = data;
  const d = await getDashboard(data);
  const me = d.table.find((t) => t.clubId === club.id);
  const next = d.nextFixtures[0];
  const nextDay = next ? career.calendar?.[next.round - 1] : null;
  const members = career.isMultiplayer ? await getMembers(id) : [];

  return (
    <div className="space-y-4">
      {career.status === "season_over" && (
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-[var(--color-accent-2)]/25 to-transparent p-5">
            <div className="label text-[var(--color-accent-2)]">Fim da temporada {career.season}</div>
            <ul className="mt-2 space-y-1 text-sm">
              {d.news.filter((n) => n.kind === "season" || n.kind === "cup").slice(0, 6).map((n) => <li key={n.id}>{n.text}</li>)}
            </ul>
            {career.isMultiplayer && !data.isHost ? (
              <p className="mt-4 text-sm text-[var(--color-muted)]">Aguardando o anfitrião iniciar a próxima temporada.</p>
            ) : (
              <form action={newSeasonAction} className="mt-4">
                <input type="hidden" name="careerId" value={career.id} />
                <button className="btn btn-primary">Começar temporada {career.season + 1}</button>
              </form>
            )}
          </div>
        </div>
      )}

      {d.pendingOffers > 0 && (
        <Link href={`/carreira/${id}/mercado?aba=propostas`} className="card flex items-center gap-3 border-[var(--color-accent-2)]/50 p-4">
          <span className="text-2xl">💰</span>
          <span className="flex-1"><b>{d.pendingOffers} proposta(s)</b> por jogadores do seu elenco aguardando resposta.</span>
          <span className="text-sm text-[var(--color-accent-2)]">Responder →</span>
        </Link>
      )}

      {career.isMultiplayer && career.status === "active" && (
        <ReadyPanel careerId={id} isHost={data.isHost} meReady={data.member.ready} members={members.map((m) => ({ name: m.user.name ?? m.user.email ?? "Técnico", club: m.club.name, ready: m.member.ready, me: m.member.userId === data.user.id }))} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="label">Próxima partida {nextDay && `· ${dayLabel(nextDay, system.cup.name, career.calendar)}`}</div>
          {next ? (
            <>
              <div className="mt-3 flex items-center justify-around gap-2 text-center">
                <TeamBlock name={next.home.name} crest={next.home.crest} pos={d.positions.get(next.home.id)} />
                <div>
                  <div className="font-display text-3xl font-bold text-[var(--color-muted)]">VS</div>
                  <div className="text-xs text-[var(--color-muted)]">dia {next.round}</div>
                </div>
                <TeamBlock name={next.away.name} crest={next.away.crest} pos={d.positions.get(next.away.id)} />
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href={`/carreira/${id}/partida`} className="btn btn-primary px-6">▶ {career.isMultiplayer ? "Dia de jogo" : "Jogar"}</Link>
                <Link href={`/carreira/${id}/tatica`} className="btn btn-ghost">Ajustar tática</Link>
              </div>
            </>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-[var(--color-muted)]">Sem partida marcada {career.status === "active" ? "agora (fora da copa ou dia de folga)" : "nesta temporada"}.</p>
              {career.status === "active" && <Link href={`/carreira/${id}/partida`} className="btn btn-ghost">Avançar o calendário</Link>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Stat label="Posição" value={me ? `${me.position}º` : "-"} sub={me ? `${me.points} pts · ${me.played} jogos` : ""} />
          <Stat label="Caixa" value={formatMoney(data.cclub.balance)} sub={<Link href={`/carreira/${id}/financas`} className="underline">ver finanças</Link>} />
          <div className="card col-span-2 p-3 lg:col-span-1">
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
                const won = f.winnerClubId ? f.winnerClubId === club.id : gf > ga;
                const res = gf === ga && !f.winnerClubId ? "E" : won ? "V" : "D";
                const o = home ? f.away : f.home;
                return (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className={`w-5 rounded text-center text-xs font-bold text-black ${res === "V" ? "bg-emerald-500" : res === "D" ? "bg-rose-500" : "bg-slate-500"}`}>{res}</span>
                    <span className="flex-1 truncate">{f.competition === "cup" ? "🏆 " : ""}{home ? "vs" : "@"} {o.name}</span>
                    <span className="font-mono">{gf}-{ga}{f.penalties ? ` (${f.penalties})` : ""}</span>
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
                  <span className="text-[var(--color-muted)]">{p.injuryDays > 0 ? `🩹 ${p.injuryDays} dias` : `🟥 ${p.suspendedRounds} jogo(s)`}</span>
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

function TeamBlock({ name, crest, pos }: { name: string; crest: Parameters<typeof Crest>[0]["crest"]; pos?: number }) {
  return (
    <div className="flex w-32 flex-col items-center gap-2 sm:w-44">
      <Crest crest={crest} size={64} />
      <div className="text-sm font-bold leading-tight">{name}</div>
      {pos ? <div className="text-xs text-[var(--color-muted)]">{pos}º lugar</div> : null}
    </div>
  );
}
