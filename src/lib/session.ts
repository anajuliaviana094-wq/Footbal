import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";

export type AppUser = typeof schema.users.$inferSelect;

/** Usuário logado (lido do banco — o plano nunca vem do token). */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return user ?? null;
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
