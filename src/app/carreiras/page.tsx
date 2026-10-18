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
  const { careers, legacy } = await listCareers(user);
  const used = careers.length + legacy.length;
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PageTitle
          title="Minhas carreiras"
          subtitle={`${used} de ${MAX_CAREERS} slots usados`}
          right={
            <div className="flex gap-2">
              <Link href="/carreiras/entrar" className="btn btn-ghost">Entrar com código</Link>
              {used < MAX_CAREERS && <Link href="/carreiras/nova" className="btn btn-primary">+ Nova carreira</Link>}
            </div>
          }
        />
        {used === 0 && (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <div className="text-5xl">⚽</div>
            <p className="text-[var(--color-muted)]">Você ainda não comanda nenhum clube.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/carreiras/nova" className="btn btn-primary">Começar minha primeira carreira</Link>
              <Link href="/carreiras/entrar" className="btn btn-ghost">Tenho um código de convite</Link>
            </div>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {careers.map(({ career, member, club, league, locked, members }) => (
            <div key={career.id} className="card relative overflow-hidden p-4">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${club.primaryColor}, ${club.secondaryColor})` }} />
              <div className="flex items-center gap-3">
                <Crest crest={club.crest} size={52} />
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-bold uppercase">{club.name}</div>
                  <div className="text-xs text-[var(--color-muted)]">{league.flag} {league.name}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
                <span>Temporada {career.season} · {career.status === "season_over" ? "encerrada" : `Dia ${career.currentRound}/${career.totalRounds}`}</span>
                {career.isMultiplayer && (
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    👥 COM AMIGOS · {members} técnico{members > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                {locked ? (
                  <Link href="/planos" className="btn btn-gold flex-1">🔒 Requer Premium</Link>
                ) : (
                  <Link href={`/carreira/${career.id}`} className="btn btn-primary flex-1">Continuar</Link>
                )}
                <form action={deleteCareerAction}>
                  <input type="hidden" name="careerId" value={career.id} />
                  <button className="btn btn-ghost text-rose-300" title={member.role === "host" ? "Excluir carreira" : "Sair da liga"}>✕</button>
                </form>
              </div>
            </div>
          ))}
          {legacy.map(({ career, club }) => (
            <div key={career.id} className="card p-4 opacity-70">
              <div className="flex items-center gap-3">
                <Crest crest={club.crest} size={44} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{club.name}</div>
                  <div className="text-xs text-amber-300">Versão antiga — sem copas, mercado e finanças</div>
                </div>
              </div>
              <form action={deleteCareerAction} className="mt-3">
                <input type="hidden" name="careerId" value={career.id} />
                <button className="btn btn-ghost w-full text-rose-300">Excluir e liberar o slot</button>
              </form>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
