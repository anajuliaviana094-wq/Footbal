import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { closeDb, getDb } from "@/db";
import { seedWorld } from "./seed";

async function main() {
  await seedWorld(getDb());
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
