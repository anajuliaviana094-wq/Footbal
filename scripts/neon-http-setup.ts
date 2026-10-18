// Migrations + seed via HTTPS (driver HTTP do Neon), útil quando a porta 5432 está bloqueada.
// Uso: DATABASE_URL=... npx tsx scripts/neon-http-setup.ts
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as schema from "@/db/schema";
import { seedWorld } from "@/seed/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  const db = drizzle(neon(url), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations aplicadas.");
  await seedWorld(db);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
