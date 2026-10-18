"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "", label: "Painel", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/elenco", label: "Elenco", icon: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0M12 7a3 3 0 1 0 0-.01" },
  { href: "/partida", label: "Jogar", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5l4 3-1.5 4.5h-5L8 10z", accent: true },
  { href: "/tatica", label: "Tática", icon: "M4 4h16v16H4zM12 4v16M4 12h4M16 12h4" },
  { href: "/tabela", label: "Tabela", icon: "M4 6h16M4 12h16M4 18h16M8 4v16" },
];

export function CareerNav({ careerId }: { careerId: string }) {
  const pathname = usePathname();
  const base = `/carreira/${careerId}`;
  const isActive = (href: string) => (href === "" ? pathname === base : pathname.startsWith(base + href));
  return (
    <>
      {/* desktop: lateral */}
      <nav className="sticky top-[57px] hidden h-[calc(100dvh-57px)] w-52 shrink-0 flex-col gap-1 border-r border-[var(--color-line)] p-3 md:flex">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={base + it.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive(it.href) ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-muted)] hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon d={it.icon} />
            {it.label}
          </Link>
        ))}
      </nav>
      {/* celular: inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--color-line)] bg-[var(--color-panel)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={base + it.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive(it.href) ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"}`}
          >
            <span className={it.accent ? "-mt-5 rounded-full bg-[var(--color-accent)] p-3 text-[#04210f] shadow-lg shadow-emerald-500/30" : ""}>
              <Icon d={it.icon} />
            </span>
            {it.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
