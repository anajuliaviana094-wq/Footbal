import { AuthForm } from "../AuthForm";

export const metadata = { title: "Entrar — Prancheta FC" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold uppercase">Entrar</h1>
      <AuthForm mode="login" />
    </>
  );
}
