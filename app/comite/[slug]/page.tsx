import { notFound } from "next/navigation";
import { CommitteeConsole } from "../../components/CommitteeConsole";
import { committeeBySlug } from "../../lib/committees";
import { getCommitteeDetail } from "../../lib/itammun-api";

export default async function CommitteePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ nombre?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const committee = committeeBySlug(slug);
  const isBlank = slug.startsWith("lienzo-");

  if (!committee && !isBlank) notFound();

  if (committee) {
    const detail = getCommitteeDetail(committee.slug);
    return <CommitteeConsole committee={committee} detail={detail} sessionKey={committee.slug} />;
  }

  return (
    <CommitteeConsole
      committee={{
        id: slug,
        slug,
        abbreviation: query.nombre || "Nuevo comité",
        name: query.nombre || "Nuevo comité",
        language: "ES",
        level: "Intermedio",
        representationType: "delegacion",
        representationsCount: 0,
        secretariat: "Lienzo en blanco",
        color: "#C2943D",
        darkColor: "#2E2812",
      }}
      detail={{ topics: [], representations: [] }}
      sessionKey={slug}
    />
  );
}
