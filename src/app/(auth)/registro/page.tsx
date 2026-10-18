import { AuthForm } from "../AuthForm";

export const metadata = { title: "Criar conta — Prancheta FC" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold uppercase">Criar conta</h1>
      <AuthForm mode="register" />
    </>
  );
}
