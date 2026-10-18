import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { careerLinks, Icon } from "../nav-links";
import { loadCareer } from "../data";

export default async function MorePage(props: PageProps<"/carreira/[id]/mais">) {
  const { id } = await props.params;
  const data = await loadCareer(id);
  if (!data) return null;
  return (
    <div>
      <PageTitle title="Clube" subtitle="Tudo sobre a gestão do seu time." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {careerLinks(data.career.isMultiplayer).map((l) => (
          <Link key={l.href} href={`/carreira/${id}${l.href}`} className="card flex flex-col items-center gap-2 p-5 text-center font-semibold hover:border-white/30">
            <span className="rounded-full bg-[var(--color-accent)]/15 p-3 text-[var(--color-accent)]"><Icon d={l.icon} /></span>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
