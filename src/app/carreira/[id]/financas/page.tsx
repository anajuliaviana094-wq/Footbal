import { PageTitle, Stat } from "@/components/ui";
import { getFinances } from "@/career/finance";
import { formatMoney } from "@/lib/format";
import { loadCareer } from "../data";

export default async function FinancePage(props: PageProps<"/carreira/[id]/financas">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  const f = await getFinances(data);
  const income = f.summary.filter((s) => s.amount > 0).reduce((a, s) => a + s.amount, 0);
  const expense = -f.summary.filter((s) => s.amount < 0).reduce((a, s) => a + s.amount, 0);
  const max = Math.max(1, ...f.summary.map((s) => Math.abs(s.amount)));
  const perHome = f.estimate.ticket;
  const perWeek = f.estimate.tv + f.estimate.sponsor;
  return (
    <div className="space-y-4">
      <PageTitle title="Finanças" subtitle={`Temporada ${data.career.season}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Caixa" value={<span className={f.balance < 0 ? "text-rose-300" : ""}>{formatMoney(f.balance)}</span>} />
        <Stat label="Folha mensal" value={formatMoney(f.monthlyWages)} sub={`${formatMoney(f.weeklyWages)} por rodada`} />
        <Stat label="Receitas na temporada" value={<span className="text-emerald-300">{formatMoney(income)}</span>} />
        <Stat label="Despesas na temporada" value={<span className="text-rose-300">{formatMoney(expense)}</span>} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="label mb-3">Balanço por categoria</div>
          {f.summary.length === 0 && <p className="text-sm text-[var(--color-muted)]">Ainda sem movimentações nesta temporada.</p>}
          <div className="space-y-2">
            {f.summary.map((s) => (
              <div key={s.kind}>
                <div className="flex justify-between text-sm"><span>{s.label}</span><b className={s.amount >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatMoney(Math.abs(s.amount))}</b></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className={`h-full rounded-full ${s.amount >= 0 ? "bg-emerald-400" : "bg-rose-400"}`} style={{ width: `${(Math.abs(s.amount) / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-white/[0.03] p-3 text-xs text-[var(--color-muted)]">
            Estádio para {f.capacity.toLocaleString("pt-BR")} torcedores. Estimativa: bilheteria de ~{formatMoney(perHome)} por jogo em casa (sobe com a boa fase) + {formatMoney(perWeek)} de TV e patrocínio por rodada. Prêmios no fim da temporada pela posição na liga e por fase alcançada na copa.
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <div className="label mb-2">Maiores salários</div>
            <ul className="space-y-1 text-sm">
              {f.topWages.map((p) => (
                <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-[var(--color-muted)]">{formatMoney(p.wage)}/mês</span></li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <div className="label mb-2">Extrato</div>
            <ul className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto text-sm">
              {f.recent.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="truncate"><span className="text-xs text-[var(--color-muted)]">dia {t.day} · </span>{t.description}</span>
                  <span className={`whitespace-nowrap font-mono ${t.amount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{t.amount >= 0 ? "+" : "−"}{formatMoney(Math.abs(t.amount))}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
