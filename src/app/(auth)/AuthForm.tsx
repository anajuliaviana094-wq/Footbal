"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? loginAction : registerAction, undefined);
  return (
    <form action={action} className="space-y-3">
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input className="input mt-1" id="name" name="name" autoComplete="name" required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input mt-1" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input
          className="input mt-1"
          id="password"
          name="password"
          type="password"
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </div>
      {state?.error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
      </button>
      <p className="text-center text-sm text-[var(--color-muted)]">
        {mode === "login" ? (
          <>Novo por aqui? <Link className="text-[var(--color-accent)] underline" href="/registro">Crie sua conta</Link></>
        ) : (
          <>Já tem conta? <Link className="text-[var(--color-accent)] underline" href="/login">Entrar</Link></>
        )}
      </p>
    </form>
  );
}
