import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import type { AppUser } from "@/lib/session";
import { Logo } from "./Logo";

export function AppHeader({ user }: { user: AppUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-bg)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/carreiras">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/planos"
            className={`rounded-full px-3 py-1 text-xs font-bold ${user.plan === "premium" ? "bg-[var(--color-accent-2)] text-black" : "border border-[var(--color-line)] text-[var(--color-muted)] hover:text-white"}`}
          >
            {user.plan === "premium" ? "★ PREMIUM" : "Plano grátis"}
          </Link>
          <form action={logoutAction}>
            <button className="rounded-full px-3 py-1 text-xs text-[var(--color-muted)] hover:text-white">Sair</button>
          </form>
        </div>
      </div>
    </header>
  );
}
