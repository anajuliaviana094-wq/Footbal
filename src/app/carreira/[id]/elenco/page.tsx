import Link from "next/link";
import { getDb } from "@/db";
import { Bar, CardIcon, OverallBadge, PageTitle, PosBadge } from "@/components/ui";
import { loadSquad } from "@/career/squad";
import { ARCHETYPE_BY_ID } from "@/seed/archetypes";
import { loadCareer } from "../data";

export default async function SquadPage(props: PageProps<"/carreira/[id]/elenco">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const squad = await loadSquad(getDb(), id, data.career.clubId);
  const avg = Math.round(squad.reduce((s, p) => s + p.overall, 0) / squad.length);

  return (
    <div>
      <PageTitle title="Elenco" subtitle={`${squad.length} jogadores · média ${avg}`} />
      {/* desktop */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--color-muted)]">
            <tr className="border-b border-[var(--color-line)]">
              <th className="p-3">#</th>
              <th className="p-3">Pos</th>
              <th className="p-3">Jogador</th>
              <th className="p-3">Idade</th>
              <th className="p-3">GER</th>
              <th className="p-3 w-32">Condição</th>
              <th className="p-3">Moral</th>
              <th className="p-3">J</th>
              <th className="p-3">G</th>
              <th className="p-3">Nota</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {squad.map((p) => (
              <tr key={p.id} className="border-b border-[var(--color-line)]/50 hover:bg-white/[0.03]">
                <td className="p-3 font-mono text-[var(--color-muted)]">{p.shirt}</td>
                <td className="p-3"><PosBadge pos={p.position} /></td>
                <td className="p-3">
                  <Link href={`/carreira/${id}/jogador/${p.id}`} className="font-semibold hover:text-[var(--color-accent)]">{p.name}</Link>
                  <div className="text-xs text-[var(--color-muted)]">{ARCHETYPE_BY_ID.get(p.archetype)?.label}</div>
                </td>
                <td className="p-3">{p.age}</td>
                <td className="p-3"><OverallBadge value={p.overall} /></td>
                <td className="p-3"><div className="flex items-center gap-2"><Bar value={p.condition} tone="auto" /><span className="w-7 text-xs">{p.condition}</span></div></td>
                <td className="p-3">{p.morale}</td>
                <td className="p-3">{p.appearances}</td>
                <td className="p-3">{p.goals}</td>
                <td className="p-3">{p.avgRating?.toFixed(1) ?? "-"}</td>
                <td className="p-3"><Status p={p} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* celular */}
      <div className="space-y-2 md:hidden">
        {squad.map((p) => (
          <Link key={p.id} href={`/carreira/${id}/jogador/${p.id}`} className="card flex items-center gap-3 p-3">
            <OverallBadge value={p.overall} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <PosBadge pos={p.position} />
                <span className="truncate font-semibold">{p.name}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <span>{p.age} anos</span>·<span>{p.goals} gols</span>
                <div className="w-16"><Bar value={p.condition} tone="auto" /></div>
              </div>
            </div>
            <Status p={p} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function Status({ p }: { p: { injuryDays: number; suspendedRounds: number; yellowAccum: number } }) {
  if (p.injuryDays > 0) return <span className="text-xs text-rose-300">🩹 {p.injuryDays}d</span>;
  if (p.suspendedRounds > 0) return <span className="text-xs text-rose-300">Suspenso</span>;
  if (p.yellowAccum > 0) return <CardIcon color="yellow" count={p.yellowAccum} />;
  return <span className="text-xs text-emerald-400">●</span>;
}
