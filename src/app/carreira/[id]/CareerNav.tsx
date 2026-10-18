"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { careerLinks, Icon, NAV_ICONS } from "./nav-links";

const MOBILE = ["", "/tatica", "/partida", "/tabela", "/mais"];

export function CareerNav({ careerId, multiplayer }: { careerId: string; multiplayer: boolean }) {
  const pathname = usePathname();
  const base = `/carreira/${careerId}`;
  const isActive = (href: string) => (href === "" ? pathname === base : pathname.startsWith(base + href));
  const links = careerLinks(multiplayer);
  const mobile = MOBILE.map((h) => (h === "/mais" ? { href: "/mais", label: "Mais", icon: NAV_ICONS.mais } : links.find((l) => l.href === h)!));
  const inMais = !MOBILE.slice(0, 4).some((h) => isActive(h)) && pathname !== base;
  return (
    <>
      <nav className="sticky top-[57px] hidden h-[calc(100dvh-57px)] w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--color-line)] p-3 md:flex">
        {links.map((it) => (
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
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--color-line)] bg-[var(--color-panel)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {mobile.map((it) => {
          const active = it.href === "/mais" ? inMais : isActive(it.href);
          return (
            <Link
              key={it.href}
              href={base + it.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"}`}
            >
              <span className={"accent" in it && it.accent ? "-mt-5 rounded-full bg-[var(--color-accent)] p-3 text-[#04210f] shadow-lg shadow-emerald-500/30" : ""}>
                <Icon d={it.icon} />
              </span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

