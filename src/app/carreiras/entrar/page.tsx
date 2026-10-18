import { AppHeader } from "@/components/AppHeader";
import { PageTitle } from "@/components/ui";
import { openClubs } from "@/career/service";
import { canAccessLeague } from "@/career/context";
import { requireUser } from "@/lib/session";
import { JoinPicker } from "./JoinPicker";

export const metadata = { title: "Entrar numa liga — Prancheta FC" };

export default async function JoinPage(props: PageProps<"/carreiras/entrar">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const code = typeof sp.codigo === "string" ? sp.codigo.trim().toUpperCase() : "";
  const data = code ? await openClubs(code) : null;
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <PageTitle title="Liga com amigos" subtitle="Digite o código que seu amigo compartilhou e escolha um clube livre." />
        <form className="card mb-4 flex gap-2 p-3" action="/carreiras/entrar">
          <input name="codigo" defaultValue={code} placeholder="Ex.: K7Q2ZP" className="input font-mono uppercase tracking-widest" maxLength={6} required />
          <button className="btn btn-primary">Buscar</button>
        </form>
        {code && !data && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">Código não encontrado.</p>}
        {data && (
          <JoinPicker
            code={code}
            system={data.system.name}
            season={data.career.season}
            leagues={data.leagues.sort((a, b) => a.tier - b.tier).map((l) => ({ id: l.id, name: l.name, locked: !canAccessLeague(user, l) }))}
            clubs={data.clubs.map((c) => ({ id: c.id, name: c.name, leagueId: c.leagueId, crest: c.crest, strength: c.strength, taken: c.taken }))}
          />
        )}
      </main>
    </>
  );
}
