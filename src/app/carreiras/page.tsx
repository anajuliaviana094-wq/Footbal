import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Crest } from "@/components/Crest";
import { PageTitle } from "@/components/ui";
import { listCareers, MAX_CAREERS } from "@/career/service";
import { requireUser } from "@/lib/session";
import { deleteCareerAction } from "./actions";

export const metadata = { title: "Minhas carreiras — Prancheta FC" };

export default async function CareersPage() {
  const user = await requireUser();
  const careers = await listCareers(user);
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PageTitle
          title="Minhas carreiras"
          subtitle={`${careers.length} de ${MAX_CAREERS} slots usados`}
          right={careers.length < MAX_CAREERS ? <Link href="/carreiras/nova" className="btn btn-primary">+ Nova carreira</Link> : null}
        />
        {careers.length === 0 && (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <div className="text-5xl">⚽</div>
            <p className="text-[var(--color-muted)]">Você ainda não comanda nenhum clube.</p>
            <Link href="/carreiras/nova" className="btn btn-primary">Começar minha primeira carreira</Link>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {careers.map(({ career, club, league, locked }) => (
            <div key={career.id} className="card relative overflow-hidden p-4">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${club.primaryColor}, ${club.secondaryColor})` }} />
              <div className="flex items-center gap-3">
                <Crest crest={club.crest} size={52} />
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-bold uppercase">{club.name}</div>
                  <div className="text-xs text-[var(--color-muted)]">{league.flag} {league.name}</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-[var(--color-muted)]">
                Temporada {career.season} · {career.status === "season_over" ? "Temporada encerrada" : `Rodada ${career.currentRound}/${career.totalRounds}`}
              </div>
              <div className="mt-4 flex gap-2">
                {locked ? (
                  <Link href="/planos" className="btn btn-gold flex-1">🔒 Requer Premium</Link>
                ) : (
                  <Link href={`/carreira/${career.id}`} className="btn btn-primary flex-1">Continuar</Link>
                )}
                <form action={deleteCareerAction}>
                  <input type="hidden" name="careerId" value={career.id} />
                  <button className="btn btn-ghost text-rose-300" title="Excluir carreira">✕</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
