"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { getDb, schema } from "@/db";

export type FormState = { error?: string } | undefined;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(60),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres").max(100),
});

export async function registerAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  const db = getDb();
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existing) return { error: "Já existe uma conta com este e-mail." };
  await db.insert(schema.users).values({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  await signIn("credentials", { email, password, redirectTo: "/carreiras" });
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/carreiras",
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: "E-mail ou senha incorretos." };
    throw err;
  }
}

export async function googleAction() {
  await signIn("google", { redirectTo: "/carreiras" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
