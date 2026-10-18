import { PageTitle } from "@/components/ui";
import { getAcademy } from "@/career/academy";
import { MAX_ACADEMY_LEVEL } from "@/career/economy";
import { formatMoney } from "@/lib/format";
import { loadCareer } from "../data";
import { AcademyList, UpgradeButton } from "./AcademyClient";

export default async function AcademyPage(props: PageProps<"/carreira/[id]/base">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const a = await getAcademy(data);
  return (
    <div className="space-y-4">
      <PageTitle title="Categorias de base" subtitle="A cada temporada chega uma nova leva de garotos. Promova os melhores ao elenco principal." />
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div>
          <div className="label">Estrutura da base</div>
          <div className="mt-1 font-display text-2xl font-bold text-[var(--color-accent-2)]">{"★".repeat(a.level)}<span className="text-white/15">{"★".repeat(MAX_ACADEMY_LEVEL - a.level)}</span></div>
          <div className="text-xs text-[var(--color-muted)]">Nível {a.level} de {MAX_ACADEMY_LEVEL} — quanto maior, mais garotos e maior o potencial.</div>
        </div>
        <div className="ml-auto text-right">
          {a.upgradeCost ? (
            <>
              <div className="text-sm text-[var(--color-muted)]">Próximo nível: {formatMoney(a.upgradeCost)} · caixa {formatMoney(data.cclub.balance)}</div>
              <UpgradeButton careerId={id} disabled={data.cclub.balance < a.upgradeCost} />
            </>
          ) : (
            <div className="text-sm text-emerald-300">Base no nível máximo</div>
          )}
        </div>
      </div>
      <AcademyList
        careerId={id}
        firstTeam={a.firstTeam}
        players={a.youth.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, age: p.age, overall: p.overall, potential: p.potential, archetype: p.archetype }))}
      />
    </div>
  );
}
