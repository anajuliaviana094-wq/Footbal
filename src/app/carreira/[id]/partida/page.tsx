import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getUserFixture } from "@/career/service";
import { MatchCenter } from "@/components/match/MatchCenter";
import { Crest } from "@/components/Crest";
import { dayLabel } from "@/lib/day";
import { loadCareer } from "../data";
import { ReadyBox } from "../ReadyBox";
import { AdvanceDay } from "./AdvanceDay";

export default async function MatchPage(props: PageProps<"/carreira/[id]/partida">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const { career, system } = data;
  const db = getDb();
  const label = dayLabel(data.day, system.cup.name, career.calendar);

  // último jogo disputado (para replay)
  const [last] = await db
    .select()
    .from(schema.fixtures)
    .where(and(eq(schema.fixtures.careerId, id), eq(schema.fixtures.season, career.season), eq(schema.fixtures.played, true)))
    .orderBy(schema.fixtures.round)
    .then((rows) => rows.filter((f) => f.homeClubId === data.clubId || f.awayClubId === data.clubId).slice(-1));

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
  const clubs = fx ? await db.select().from(schema.clubs).where(inArray(schema.clubs.id, [fx.homeClubId, fx.awayClubId])) : [];
  const home = fx ? clubs.find((c) => c.id === fx.homeClubId)! : null;
  const away = fx ? clubs.find((c) => c.id === fx.awayClubId)! : null;

  const replay = last?.matchId ? (
    <Link href={`/carreira/${id}/partida/${last.matchId}`} className="btn btn-ghost">▶ Replay do último jogo</Link>
  ) : null;

  if (career.isMultiplayer) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {home && away ? (
          <div className="card p-6 text-center">
            <div className="label">{label}</div>
            <div className="mt-4 flex items-center justify-around">
              <div className="flex w-36 flex-col items-center gap-2"><Crest crest={home.crest} size={64} /><b>{home.name}</b></div>
              <span className="font-display text-3xl font-bold text-[var(--color-muted)]">VS</span>
              <div className="flex w-36 flex-col items-center gap-2"><Crest crest={away.crest} size={64} /><b>{away.name}</b></div>
            </div>
            <Link href={`/carreira/${id}/tatica`} className="mt-4 inline-block text-sm text-[var(--color-muted)] underline">Revisar tática</Link>
          </div>
        ) : (
          <div className="card p-6 text-center text-[var(--color-muted)]">{label}: seu time não joga neste dia.</div>
        )}
        <ReadyBox data={data} />
        <div className="text-center">{replay}</div>
      </div>
    );
  }

  if (!fx || !home || !away) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="text-5xl">📅</div>
        <p className="mt-3"><b>{label}</b></p>
        <p className="text-[var(--color-muted)]">Seu time não joga neste dia (fora da copa ou classificado direto para a próxima fase).</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <AdvanceDay careerId={id} />
          {replay}
        </div>
      </div>
    );
  }
  const [live] = await db
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(and(eq(schema.matches.fixtureId, fx.id), eq(schema.matches.status, "live")));
  return (
    <div className="space-y-3">
      <MatchCenter
        info={{
          careerId: id,
          round: career.currentRound,
          label,
          home: { name: home.name, crest: home.crest },
          away: { name: away.name, crest: away.crest },
          hasLiveMatch: Boolean(live),
        }}
      />
      {replay && <div className="text-center">{replay}</div>}
    </div>
  );
}
