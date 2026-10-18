import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/Logo";

const FEATURES = [
  { t: "Motor de partida realista", d: "Cada lance é simulado com atributos, traços de personalidade, tática, moral e condição física." },
  { t: "Personalidade importa", d: "O volante esquentado comete mais faltas, reclama e pode ser expulso no jogo tenso." },
  { t: "Narração com IA", d: "Lances decisivos narrados no tom de rádio brasileiro, com contexto de cada jogador." },
  { t: "Campo 2D ao vivo", d: "Acompanhe as 22 peças em campo, mexa no time e mude a tática durante o jogo." },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/carreiras");
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <Link href="/login" className="btn btn-ghost text-sm">Entrar</Link>
      </header>
      <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-2">
        <div>
          <p className="label text-[var(--color-accent)]">Gerenciamento de futebol com IA</p>
          <h1 className="mt-3 font-display text-5xl font-bold uppercase leading-[0.95] sm:text-6xl">
            Monte o time.<br />Arme a tática.<br /><span className="text-[var(--color-accent)]">Leve a taça.</span>
          </h1>
          <p className="mt-5 max-w-md text-[var(--color-muted)]">
            Escolha um clube em uma das 8 ligas fictícias, administre o elenco rodada a rodada e acompanhe cada partida no campo 2D.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registro" className="btn btn-primary px-6 py-3 text-lg">Começar grátis</Link>
            <Link href="/planos" className="btn btn-ghost px-6 py-3 text-lg">Ver planos</Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.t} className="card p-5">
              <div className="font-display text-lg font-bold uppercase">{f.t}</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="py-6 text-center text-xs text-[var(--color-muted)]">
        Todos os nomes de ligas, clubes, cidades e jogadores são fictícios.
      </footer>
    </main>
  );
}
