import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getUserFixture } from "@/career/service";
import { MatchCenter } from "@/components/match/MatchCenter";
import { loadCareer } from "../data";

export default async function MatchPage(props: PageProps<"/carreira/[id]/partida">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const { career } = data;
  if (career.status === "season_over") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="text-5xl">🏁</div>
        <p className="mt-3">A temporada terminou.</p>
        <Link href={`/carreira/${id}`} className="btn btn-primary mt-4">Ver resumo e iniciar nova temporada</Link>
      </div>
    );
  }
  const fx = await getUserFixture(data);
  if (!fx) return <p className="text-[var(--color-muted)]">Nenhuma partida nesta rodada.</p>;
  const db = getDb();
  const clubs = await db.select().from(schema.clubs).where(inArray(schema.clubs.id, [fx.homeClubId, fx.awayClubId]));
  const home = clubs.find((c) => c.id === fx.homeClubId)!;
  const away = clubs.find((c) => c.id === fx.awayClubId)!;
  const [live] = await db
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(and(eq(schema.matches.fixtureId, fx.id), eq(schema.matches.status, "live")));
  return (
    <MatchCenter
      info={{
        careerId: id,
        round: career.currentRound,
        home: { name: home.name, crest: home.crest },
        away: { name: away.name, crest: away.crest },
        hasLiveMatch: Boolean(live),
      }}
    />
  );
}
