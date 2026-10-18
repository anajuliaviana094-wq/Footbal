import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { getDb, schema } from "@/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Config lazy: o banco só é acessado em tempo de requisição (não no build).
export const { handlers, auth, signIn, signOut } = NextAuth((): NextAuthConfig => {
  const db = getDb();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
    // Credentials exige JWT; o adapter continua persistindo usuários/contas do Google.
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    trustHost: true,
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) return null;
          const email = parsed.data.email.toLowerCase();
          const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
          if (!user?.passwordHash) return null;
          const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
          if (!ok) return null;
          return { id: user.id, name: user.name, email: user.email, image: user.image };
        },
      }),
      ...(googleEnabled ? [Google({ allowDangerousEmailAccountLinking: true })] : []),
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user?.id) token.uid = user.id;
        return token;
      },
      session({ session, token }) {
        if (token.uid && session.user) session.user.id = token.uid as string;
        return session;
      },
    },
  };
});
