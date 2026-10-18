import { getLastResult } from "@/career/queries";
import { getMembers } from "@/career/service";
import { dayLabel } from "@/lib/day";
import type { loadCareer } from "./data";
import { ReadyPanel } from "./ReadyPanel";

type CareerData = NonNullable<Awaited<ReturnType<typeof loadCareer>>>;

/** Painel "Estou pronto" da liga com amigos, com os dados já carregados no servidor. */
export async function ReadyBox({ data }: { data: CareerData }) {
  const { career, system } = data;
  const [members, last] = await Promise.all([getMembers(career.id), getLastResult(career.id, career.season, data.clubId)]);
  return (
    <ReadyPanel
      careerId={career.id}
      isHost={data.isHost}
      meReady={data.member.ready}
      members={members.map((m) => ({ name: m.user.name ?? m.user.email ?? "Técnico", club: m.club.name, ready: m.member.ready, me: m.member.userId === data.user.id }))}
      day={career.currentRound}
      dayLabel={dayLabel(data.day, system.cup.name, career.calendar)}
      lastResult={last}
    />
  );
}
