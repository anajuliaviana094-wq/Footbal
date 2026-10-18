import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PageTitle } from "@/components/ui";
import { getBillingProvider } from "@/billing";
import { PLANS } from "@/billing/plans";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Planos — Prancheta FC" };

export default async function PlansPage(props: PageProps<"/planos">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const configured = getBillingProvider().isConfigured();
  return (
    <>
      {user ? <AppHeader user={user} /> : null}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <PageTitle title="Planos" subtitle="Comece grátis. Libere todas as ligas quando quiser." />
        {sp.status === "sucesso" && (
          <p className="mb-4 rounded-lg bg-emerald-500/15 px-4 py-3 text-emerald-200">
            {user?.plan === "premium"
              ? "Bem-vindo ao Premium! Todas as ligas estão liberadas."
              : "Pagamento recebido! Seu plano Premium é ativado assim que o pagamento for confirmado (geralmente em segundos). Recarregue a página em instantes."}
          </p>
        )}
        {sp.status === "cancelado" && <p className="mb-4 rounded-lg bg-white/5 px-4 py-3 text-[var(--color-muted)]">Checkout cancelado.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {(["free", "premium"] as const).map((id) => {
            const plan = PLANS[id];
            const current = user?.plan === id;
            return (
              <div key={id} className={`card p-6 ${id === "premium" ? "ring-2 ring-[var(--color-accent-2)]" : ""}`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-bold uppercase">{plan.name}</h2>
                  {current && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">Seu plano</span>}
                </div>
                <div className="mt-2 font-display text-4xl font-bold text-[var(--color-accent-2)]">{plan.priceLabel}</div>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2"><span className="text-[var(--color-accent)]">✓</span>{f}</li>
                  ))}
                </ul>
                <div className="mt-6">
                  {id === "premium" && !user && <Link href="/registro" className="btn btn-gold w-full">Criar conta para assinar</Link>}
                  {id === "premium" && user && user.plan !== "premium" && (
                    <form action="/api/billing/checkout" method="post">
                      <button className="btn btn-gold w-full" disabled={!configured}>Assinar Premium</button>
                      {!configured && <p className="mt-2 text-xs text-[var(--color-muted)]">Pagamentos ainda não configurados neste ambiente.</p>}
                    </form>
                  )}
                  {id === "premium" && user?.plan === "premium" && user.stripeCustomerId && (
                    <form action="/api/billing/portal" method="post">
                      <button className="btn btn-ghost w-full">Gerenciar assinatura</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-[var(--color-muted)]">Ambiente de testes: use o cartão 4242 4242 4242 4242 com qualquer data futura e CVC.</p>
      </main>
    </>
  );
}
