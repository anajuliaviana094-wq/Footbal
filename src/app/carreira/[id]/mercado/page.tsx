import Link from "next/link";
import { LEAGUES, LEAGUE_BY_ID } from "@/data/leagues";
import { getDb } from "@/db";
import { Crest } from "@/components/Crest";
import { OverallBadge, PageTitle, PosBadge } from "@/components/ui";
import { listOffers, searchMarket } from "@/career/market";
import { loadSquad } from "@/career/squad";
import { POSITIONS, POSITION_LABEL, type Position } from "@/engine/types";
import { formatMoney } from "@/lib/format";
import { loadCareer } from "../data";
import { OfferButtons } from "./OfferButtons";

const TABS = [
  ["buscar", "Buscar jogadores"],
  ["propostas", "Propostas"],
  ["vendas", "Meus à venda"],
] as const;

export default async function MarketPage(props: PageProps<"/carreira/[id]/mercado">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const data = await loadCareer(id);
  if (!data) return null;
  const tab = (typeof sp.aba === "string" ? sp.aba : "buscar") as (typeof TABS)[number][0];
  const base = `/carreira/${id}/mercado`;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return (
    <div>
      <PageTitle title="Mercado" subtitle={`Caixa disponível: ${formatMoney(data.cclub.balance)} · janela de transferências aberta`} />
      <div className="scrollbar-thin mb-4 flex gap-1 overflow-x-auto">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`${base}?aba=${k}`} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-[var(--color-accent)] text-[#04210f]" : "bg-white/5 text-[var(--color-muted)] hover:text-white"}`}>
            {label}
          </Link>
        ))}
      </div>
      {tab === "buscar" && (
        <Search
          careerId={id}
          ctx={data}
          filters={{
            position: (POSITIONS as readonly string[]).includes(str("pos")) ? (str("pos") as Position) : "",
            leagueId: str("liga"),
            maxValue: Number(str("max")) || undefined,
            minOverall: Number(str("ger")) || undefined,
            maxAge: Number(str("idade")) || undefined,
            name: str("nome"),
            onlyListed: str("venda") === "1",
          }}
          raw={{ pos: str("pos"), liga: str("liga"), max: str("max"), ger: str("ger"), idade: str("idade"), nome: str("nome"), venda: str("venda") }}
        />
      )}
      {tab === "propostas" && <Offers careerId={id} ctx={data} />}
      {tab === "vendas" && <Listed careerId={id} clubId={data.clubId} />}
    </div>
  );
}

async function Search({ careerId, ctx, filters, raw }: { careerId: string; ctx: NonNullable<Awaited<ReturnType<typeof loadCareer>>>; filters: Parameters<typeof searchMarket>[1]; raw: Record<string, string> }) {
  const results = await searchMarket(ctx, filters);
  return (
    <>
      <form className="card mb-4 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-7" action={`/carreira/${careerId}/mercado`}>
        <input type="hidden" name="aba" value="buscar" />
        <input name="nome" defaultValue={raw.nome} placeholder="Nome" className="input col-span-2 py-2 text-sm" />
        <select name="pos" defaultValue={raw.pos} className="input py-2 text-sm">
          <option value="">Posição</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
        </select>
        <select name="liga" defaultValue={raw.liga} className="input py-2 text-sm">
          <option value="">Todas as ligas</option>
          {LEAGUES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input name="ger" defaultValue={raw.ger} inputMode="numeric" placeholder="Geral mín." className="input py-2 text-sm" />
        <input name="idade" defaultValue={raw.idade} inputMode="numeric" placeholder="Idade máx." className="input py-2 text-sm" />
        <input name="max" defaultValue={raw.max} inputMode="numeric" placeholder="Valor máx. (R$)" className="input py-2 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="venda" value="1" defaultChecked={raw.venda === "1"} /> Só à venda</label>
        <button className="btn btn-primary col-span-2 py-2 sm:col-span-1">Buscar</button>
      </form>
      {results.length === 0 && <p className="text-[var(--color-muted)]">Nenhum jogador encontrado com esses filtros.</p>}
      <div className="card divide-y divide-[var(--color-line)]/60">
        {results.map(({ player: p, club, leagueId }) => (
          <Link key={p.id} href={`/carreira/${careerId}/jogador/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-white/[0.03]">
            <OverallBadge value={p.overall} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <PosBadge pos={p.position} />
                <span className="truncate font-semibold">{p.firstName} {p.lastName}</span>
                {p.transferListed && <span className="rounded bg-amber-400/15 px-1.5 text-[10px] font-bold text-amber-300">À VENDA</span>}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[var(--color-muted)]">
                <Crest crest={club.crest} size={14} /> {club.name} · {LEAGUE_BY_ID.get(leagueId)?.name} · {p.age} anos · pot. {p.potential}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{formatMoney(p.transferListed && p.askingPrice ? p.askingPrice : p.value)}</div>
              <div className="text-xs text-[var(--color-muted)]">{formatMoney(p.wage)}/mês</div>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">Toque num jogador para ver o perfil e fazer uma proposta.</p>
    </>
  );
}

async function Offers({ careerId, ctx }: { careerId: string; ctx: NonNullable<Awaited<ReturnType<typeof loadCareer>>> }) {
  const offers = await listOffers(ctx);
  const incoming = offers.filter((o) => o.incoming);
  const outgoing = offers.filter((o) => !o.incoming);
  const status: Record<string, string> = { pending: "pendente", accepted: "aceita", rejected: "recusada", expired: "expirou", withdrawn: "cancelada" };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section>
        <div className="label mb-2">Recebidas</div>
        {incoming.length === 0 && <p className="text-sm text-[var(--color-muted)]">Nenhuma proposta. Coloque jogadores à venda no perfil deles para atrair interessados.</p>}
        <div className="space-y-2">
          {incoming.map((o) => (
            <div key={o.id} className="card p-3">
              <div className="flex items-center gap-2">
                <Crest crest={o.buyer.crest} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm"><b>{o.buyer.name}</b> quer <Link href={`/carreira/${careerId}/jogador/${o.playerId}`} className="underline">{o.player.shortName}</Link></div>
                  <div className="text-xs text-[var(--color-muted)]">{formatMoney(o.fee)} · {status[o.status]}{o.status === "pending" && ` · expira no dia ${o.expiresDay}`}</div>
                </div>
              </div>
              {o.status === "pending" && <OfferButtons careerId={careerId} offerId={o.id} />}
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="label mb-2">Enviadas</div>
        {outgoing.length === 0 && <p className="text-sm text-[var(--color-muted)]">Você ainda não fez propostas a outros técnicos.</p>}
        <div className="space-y-2">
          {outgoing.map((o) => (
            <div key={o.id} className="card flex items-center gap-2 p-3">
              <Crest crest={o.seller.crest} size={28} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate">{o.player.shortName} ({o.seller.name})</div>
                <div className="text-xs text-[var(--color-muted)]">{formatMoney(o.fee)} · {status[o.status]}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function Listed({ careerId, clubId }: { careerId: string; clubId: number }) {
  const squad = (await loadSquad(getDb(), careerId, clubId)).filter((p) => p.transferListed);
  if (!squad.length) return <p className="text-[var(--color-muted)]">Nenhum jogador à venda. Abra o perfil de um jogador do seu elenco e use “Colocar à venda”.</p>;
  return (
    <div className="card divide-y divide-[var(--color-line)]/60">
      {squad.map((p) => (
        <Link key={p.id} href={`/carreira/${careerId}/jogador/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-white/[0.03]">
          <OverallBadge value={p.overall} />
          <span className="flex-1 truncate font-semibold">{p.name}</span>
          <span className="text-sm">{formatMoney(p.askingPrice ?? p.value)}</span>
        </Link>
      ))}
    </div>
  );
}
