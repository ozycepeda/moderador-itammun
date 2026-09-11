import { notFound, redirect } from "next/navigation";
import { committeeBySlug } from "../../../lib/committees";

export default async function SetupPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ nombre?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const committee = committeeBySlug(slug);
  const isBlank = slug.startsWith("lienzo-");
  if (!committee && !isBlank) notFound();

  const suffix = query.nombre ? `?nombre=${encodeURIComponent(query.nombre)}` : "";
  redirect(`/comite/${slug}${suffix}`);
}
