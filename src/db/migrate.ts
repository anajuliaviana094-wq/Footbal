import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "./index";

async function main() {
  const db = getDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations aplicadas.");
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
