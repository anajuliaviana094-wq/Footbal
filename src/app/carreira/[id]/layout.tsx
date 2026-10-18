import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Crest } from "@/components/Crest";
import { getCareer } from "@/career/service";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { CareerNav } from "./CareerNav";
import { loadCareer } from "./data";

export default async function CareerLayout(props: LayoutProps<"/carreira/[id]">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) {
    const user = await requireUser();
    let message = "Carreira não encontrada";
    let premium = false;
    try {
      await getCareer(user, id);
    } catch (err) {
      if (err instanceof AppError) {
        message = err.message;
        premium = err.code === "premium_required";
      }
    }
    return (
      <>
        <AppHeader user={user} />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="text-5xl">{premium ? "🔒" : "🤷"}</div>
          <p className="mt-4 text-lg">{message}</p>
          <div className="mt-6 flex justify-center gap-2">
            {premium && <Link href="/planos" className="btn btn-gold">Ver planos</Link>}
            <Link href="/carreiras" className="btn btn-ghost">Minhas carreiras</Link>
          </div>
        </main>
      </>
    );
  }
  const { user, career, club, league } = data;
  return (
    <>
      <AppHeader user={user} />
      <div className="mx-auto flex max-w-7xl">
        <CareerNav careerId={id} />
        <div className="min-w-0 flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-10">
          <div className="mb-4 flex items-center gap-3">
            <Crest crest={club.crest} size={40} />
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-bold uppercase leading-tight">{club.name}</div>
              <div className="truncate text-xs text-[var(--color-muted)]">
                {league.flag} {league.name} · Temporada {career.season} ·{" "}
                {career.status === "season_over" ? "encerrada" : `Rodada ${career.currentRound}/${career.totalRounds}`}
              </div>
            </div>
          </div>
          {props.children}
        </div>
      </div>
    </>
  );
}
