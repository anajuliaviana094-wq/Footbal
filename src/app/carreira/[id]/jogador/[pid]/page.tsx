import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/Crest";
import { Bar, OverallBadge, PosBadge } from "@/components/ui";
import { getPlayerProfile } from "@/career/queries";
import { ATTRIBUTE_LABEL, POSITION_LABEL, TRAIT_LABEL, type Attributes, type Traits } from "@/engine/types";
import { formatMoney } from "@/lib/format";
import { ARCHETYPE_BY_ID } from "@/seed/archetypes";
import { loadCareer } from "../../data";
import { ScoutReport } from "./ScoutReport";

const OUTFIELD: (keyof Attributes)[] = ["finalizacao", "passe", "drible", "cruzamento", "cabeceio", "visao", "desarme", "marcacao", "posicionamento", "velocidade", "resistencia", "forca"];
const GK: (keyof Attributes)[] = ["reflexo", "posicionamento", "saida_gol", "jogo_pes", "forca", "resistencia"];

export default async function PlayerPage(props: PageProps<"/carreira/[id]/jogador/[pid]">) {
  const { id, pid } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const profile = await getPlayerProfile(id, Number(pid));
  if (!profile) notFound();
  const { player: p, club } = profile;
  const keys = p.position === "GOL" ? GK : OUTFIELD;
  const isMine = club.id === data.career.clubId;

  return (
    <div className="space-y-4">
      <Link href={isMine ? `/carreira/${id}/elenco` : `/carreira/${id}/tabela`} className="text-sm text-[var(--color-muted)] hover:text-white">← Voltar</Link>
      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 p-5" style={{ background: `linear-gradient(120deg, ${club.primaryColor}33, transparent 60%)` }}>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 font-display text-4xl font-bold" style={{ borderColor: club.primaryColor, background: `${club.primaryColor}22` }}>
            {p.shirt}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-2xl font-bold uppercase">{p.firstName} {p.lastName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
              <PosBadge pos={p.position} /> {POSITION_LABEL[p.position]} · {p.age} anos · {p.nationality}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <Crest crest={club.crest} size={18} /> {club.name}
            </div>
          </div>
          <div className="text-center">
            <OverallBadge value={p.overall} className="h-12 min-w-14 text-2xl" />
            <div className="mt-1 text-[10px] text-[var(--color-muted)]">POT {p.potential}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[var(--color-line)] text-center text-sm sm:grid-cols-4">
          {[
            ["Arquétipo", ARCHETYPE_BY_ID.get(p.archetype)?.label ?? p.archetype],
            ["Pé / Altura", `${p.foot === "E" ? "Esquerdo" : p.foot === "A" ? "Ambos" : "Direito"} · ${p.height} cm`],
            ["Valor", formatMoney(p.value)],
            ["Salário", `${formatMoney(p.wage)}/mês`],
          ].map(([l, v]) => (
            <div key={l} className="bg-[var(--color-panel)] p-3">
              <div className="label">{l}</div>
              <div className="mt-0.5 font-semibold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <ScoutReport careerId={id} playerId={p.id} initial={p.scoutReport} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="label mb-3">Atributos</div>
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 text-[var(--color-muted)]">{ATTRIBUTE_LABEL[k]}</span>
                <Bar value={p.attrs[k]} tone="auto" />
                <span className="w-7 text-right font-mono font-bold">{p.attrs[k]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <div className="label mb-3">Personalidade</div>
            <div className="space-y-2">
              {(Object.keys(TRAIT_LABEL) as (keyof Traits)[]).map((k) => (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 text-[var(--color-muted)]">{TRAIT_LABEL[k]}</span>
                  <Bar value={p.traits[k]} tone={k === "agressividade" || k === "temperamento" || k === "propensao_lesao" ? "danger" : "gold"} />
                  <span className="w-7 text-right font-mono font-bold">{p.traits[k]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <div className="label mb-3">Temporada</div>
            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {[
                ["Jogos", p.appearances],
                ["Gols", p.goals],
                ["Assist.", p.assists],
                ["🟨", p.yellows],
                ["🟥", p.reds],
                ["Nota", p.avgRating?.toFixed(1) ?? "-"],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-lg bg-white/[0.04] p-2">
                  <div className="font-display text-xl font-bold">{v}</div>
                  <div className="text-[10px] text-[var(--color-muted)]">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>Condição <Bar value={p.condition} tone="auto" /></div>
              <div>Moral <Bar value={p.morale} tone="auto" /></div>
            </div>
            {(p.injuryDays > 0 || p.suspendedRounds > 0 || p.yellowAccum > 0) && (
              <p className="mt-3 text-sm text-rose-300">
                {p.injuryDays > 0 && `Lesionado: ${p.injuryDays} dias. `}
                {p.suspendedRounds > 0 && `Suspenso por ${p.suspendedRounds} jogo(s). `}
                {p.yellowAccum > 0 && `${p.yellowAccum} amarelo(s) acumulado(s).`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
