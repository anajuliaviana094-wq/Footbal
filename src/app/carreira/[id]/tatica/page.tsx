import { getDb } from "@/db";
import { PageTitle } from "@/components/ui";
import { loadSquad, resolveUserLineup } from "@/career/squad";
import { loadCareer } from "../data";
import { TacticsEditor } from "./TacticsEditor";

export default async function TacticsPage(props: PageProps<"/carreira/[id]/tatica">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const squad = (await loadSquad(getDb(), id, data.clubId)).filter((p) => p.squadRole === "first");
  const tactics = data.member.tactics;
  // a escalação salva é usada como está; sem escalação salva, sugerimos a automática
  const saved = data.member.lineup;
  const initial = saved ?? (() => {
    const auto = resolveUserLineup(squad, tactics, null);
    return { starters: auto.starters.map((p) => p.id), bench: auto.bench.map((p) => p.id) };
  })();
  return (
    <div>
      <PageTitle title="Tática" subtitle="Toque em dois jogadores para trocá-los (ou arraste no computador)." />
      <TacticsEditor careerId={id} squad={squad} tactics={tactics} lineup={initial} color={data.club.primaryColor} />
    </div>
  );
}
