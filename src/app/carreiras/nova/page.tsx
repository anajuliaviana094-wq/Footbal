import { AppHeader } from "@/components/AppHeader";
import { PageTitle } from "@/components/ui";
import { getDb, schema } from "@/db";
import { listLeagues } from "@/career/service";
import { requireUser } from "@/lib/session";
import { NewCareerPicker } from "./NewCareerPicker";

export const metadata = { title: "Nova carreira — Prancheta FC" };

export default async function NewCareerPage() {
  const user = await requireUser();
  const leagues = await listLeagues(user);
  const clubs = await getDb().select().from(schema.clubs);
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PageTitle title="Nova carreira" subtitle="Escolha a liga e o clube que você vai comandar." />
        <NewCareerPicker
          leagues={leagues.map((l) => ({ id: l.id, name: l.name, flag: l.flag, inspiration: l.inspiration, level: l.level, isFree: l.isFree, locked: l.locked }))}
          clubs={clubs.map((c) => ({ id: c.id, leagueId: c.leagueId, name: c.name, city: c.city, strength: c.strength, crest: c.crest, primaryColor: c.primaryColor }))}
        />
      </main>
    </>
  );
}
