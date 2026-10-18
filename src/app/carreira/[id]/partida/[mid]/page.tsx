import { MatchReplay } from "@/components/match/MatchCenter";
import { loadCareer } from "../../data";

export default async function ReplayPage(props: PageProps<"/carreira/[id]/partida/[mid]">) {
  const { id, mid } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  return <MatchReplay matchId={Number(mid)} />;
}
