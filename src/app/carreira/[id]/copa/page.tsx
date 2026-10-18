import Link from "next/link";
import { Crest } from "@/components/Crest";
import { PageTitle } from "@/components/ui";
import { cupStageCount, cupStageName } from "@/career/cup";
import { getCup } from "@/career/queries";
import { loadCareer } from "../data";

export default async function CupPage(props: PageProps<"/carreira/[id]/copa">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const { career, system } = data;
  const stages = await getCup(id, career.season, system.cup.id);
  const total = career.calendar?.filter((d) => d.type === "cup").length ?? cupStageCount(2);
  const final = stages.find(([s]) => s === total)?.[1][0];
  const champion = final?.played ? (final.winnerClubId === final.homeClubId ? final.home : final.away) : null;
  const myStages = stages.filter(([, list]) => list.some((f) => f.homeClubId === data.clubId || f.awayClubId === data.clubId));
  const lastMine = myStages.at(-1);
  const eliminated = lastMine?.[1].some((f) => (f.homeClubId === data.clubId || f.awayClubId === data.clubId) && f.played && f.winnerClubId !== data.clubId);

  return (
    <div>
      <PageTitle title={system.cup.name} subtitle={`Mata-mata em jogo único com todos os clubes de ${system.name}. Empate vai para os pênaltis.`} />
      {champion && (
        <div className="card mb-4 flex items-center gap-3 bg-gradient-to-r from-[var(--color-accent-2)]/20 to-transparent p-4">
          <Crest crest={champion.crest} size={48} />
          <div className="font-display text-xl font-bold uppercase">🏆 {champion.name} campeão</div>
        </div>
      )}
      {!champion && (
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          {eliminated ? "Seu time foi eliminado." : myStages.length ? "Seu time segue vivo na copa!" : "Seu time estreia direto na 2ª fase (cabeça de chave)."}
        </p>
      )}
      <div className="space-y-5">
        {stages.map(([stage, list]) => (
          <section key={stage}>
            <div className="label mb-2">{cupStageName(stage, total)} · dia {list[0]?.round}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((f) => {
                const mine = f.homeClubId === data.clubId || f.awayClubId === data.clubId;
                return (
                  <div key={f.id} className={`card p-3 text-sm ${mine ? "ring-1 ring-[var(--color-accent)]" : ""}`}>
                    {[f.home, f.away].map((c, i) => {
                      const goals = i === 0 ? f.homeGoals : f.awayGoals;
                      const won = f.played && f.winnerClubId === c.id;
                      return (
                        <div key={c.id} className={`flex items-center gap-2 py-0.5 ${f.played && !won ? "opacity-50" : ""}`}>
                          <Crest crest={c.crest} size={20} />
                          <span className={`flex-1 truncate ${won ? "font-bold" : ""}`}>{c.name}</span>
                          <span className="font-mono font-bold">{f.played ? goals : ""}</span>
                        </div>
                      );
                    })}
                    {f.penalties && <div className="mt-1 text-right text-[10px] text-[var(--color-muted)]">pênaltis {f.penalties}</div>}
                    {mine && f.matchId && <Link href={`/carreira/${id}/partida/${f.matchId}`} className="mt-1 block text-right text-xs text-[var(--color-accent)] underline">replay</Link>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {stages.length < total && !champion && <p className="text-sm text-[var(--color-muted)]">As próximas fases são sorteadas quando a anterior termina.</p>}
      </div>
    </div>
  );
}
