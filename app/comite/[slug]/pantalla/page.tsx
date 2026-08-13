import { notFound } from "next/navigation";
import { ProjectorView } from "../../../components/ProjectorView";
import { committeeBySlug } from "../../../lib/committees";

export default async function ProjectorPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ nombre?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const committee = committeeBySlug(slug);
  const isBlank = slug.startsWith("lienzo-");
  if (!committee && !isBlank) notFound();

  const resolved = committee ?? {
    id: slug, slug, abbreviation: query.nombre || "Nuevo comité", name: query.nombre || "Nuevo comité",
    language: "ES" as const, level: "Intermedio" as const, representationType: "delegacion" as const,
    representationsCount: 0, secretariat: "Lienzo en blanco", color: "#C2943D", darkColor: "#2E2812",
  };
  return <ProjectorView committee={resolved} sessionKey={slug} />;
}
