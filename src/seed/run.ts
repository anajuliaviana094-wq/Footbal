import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/db";
import { generateWorld } from "./generate";

/** Seed determinístico (upsert): pode ser rodado várias vezes sem quebrar carreiras existentes. */
async function main() {
  const db = getDb();
  const world = generateWorld();
  console.log(`Gerando ${world.leagues.length} ligas, ${world.clubs.length} clubes, ${world.players.length} jogadores...`);

  await db
    .insert(schema.leagues)
    .values(world.leagues)
    .onConflictDoUpdate({
      target: schema.leagues.id,
      set: {
        name: sql`excluded.name`,
        country: sql`excluded.country`,
        flag: sql`excluded.flag`,
        inspiration: sql`excluded.inspiration`,
        level: sql`excluded.level`,
        isFree: sql`excluded.is_free`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  await db
    .insert(schema.clubs)
    .values(world.clubs)
    .onConflictDoUpdate({
      target: schema.clubs.id,
      set: {
        leagueId: sql`excluded.league_id`,
        name: sql`excluded.name`,
        shortName: sql`excluded.short_name`,
        city: sql`excluded.city`,
        stadium: sql`excluded.stadium`,
        primaryColor: sql`excluded.primary_color`,
        secondaryColor: sql`excluded.secondary_color`,
        crest: sql`excluded.crest`,
        strength: sql`excluded.strength`,
        defaultFormation: sql`excluded.default_formation`,
      },
    });

  const rows = world.players.map(({ attrs, ...p }) => ({ ...p, attributes: attrs }));
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(schema.players)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: schema.players.id,
        set: {
          clubId: sql`excluded.club_id`,
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          shortName: sql`excluded.short_name`,
          nationality: sql`excluded.nationality`,
          age: sql`excluded.age`,
          position: sql`excluded.position`,
          foot: sql`excluded.foot`,
          height: sql`excluded.height`,
          archetype: sql`excluded.archetype`,
          attributes: sql`excluded.attributes`,
          traits: sql`excluded.traits`,
          potential: sql`excluded.potential`,
          overall: sql`excluded.overall`,
          value: sql`excluded.value`,
          wage: sql`excluded.wage`,
          shirtNumber: sql`excluded.shirt_number`,
        },
      });
  }
  console.log("Seed concluído.");
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
