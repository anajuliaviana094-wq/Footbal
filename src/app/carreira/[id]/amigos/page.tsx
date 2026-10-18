import { PageTitle } from "@/components/ui";
import { getMembers } from "@/career/service";
import { loadCareer } from "../data";
import { ReadyPanel } from "../ReadyPanel";
import { CopyCode } from "./CopyCode";

export default async function FriendsPage(props: PageProps<"/carreira/[id]/amigos">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  if (!data.career.isMultiplayer) return <p className="text-[var(--color-muted)]">Esta é uma carreira individual. Crie uma nova carreira marcando “Liga com amigos”.</p>;
  const members = await getMembers(id);
  return (
    <div className="space-y-4">
      <PageTitle title="Liga com amigos" subtitle={`${members.length} técnico(s) · clubes de ${data.system.name}`} />
      <div className="card p-5">
        <div className="label">Código de convite</div>
        <CopyCode code={data.career.inviteCode ?? ""} />
        <p className="mt-2 text-sm text-[var(--color-muted)]">Seus amigos entram em <b>Minhas carreiras → Entrar com código</b> e escolhem um clube livre de qualquer divisão de {data.system.name}. Ligas premium exigem plano Premium de quem entra.</p>
      </div>
      {data.career.status === "active" && (
        <ReadyPanel careerId={id} isHost={data.isHost} meReady={data.member.ready} members={members.map((m) => ({ name: m.user.name ?? m.user.email ?? "Técnico", club: m.club.name, ready: m.member.ready, me: m.member.userId === data.user.id }))} />
      )}
      <div className="card p-5 text-sm text-[var(--color-muted)]">
        <div className="label mb-2">Como funciona</div>
        <ul className="list-disc space-y-1 pl-5">
          <li>Cada técnico monta sua tática e escalação; depois marca “Estou pronto”.</li>
          <li>Quando todos estão prontos (ou o anfitrião processa), os jogos do dia são simulados juntos.</li>
          <li>Cada um assiste ao replay da própria partida em Jogar ou na Tabela.</li>
          <li>Dá para negociar jogadores entre vocês: a proposta fica pendente até o outro técnico responder no Mercado.</li>
        </ul>
      </div>
    </div>
  );
}
