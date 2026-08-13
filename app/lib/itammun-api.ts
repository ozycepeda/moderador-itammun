import type { Committee } from "./committees";

export type Representation = {
  id: string;
  name: string;
  flagUrl?: string;
  observer: boolean;
};

export type CommitteeDetail = {
  topics: string[];
  representations: Representation[];
};

const fallbackRepresentations = [
  "Alemania", "Argentina", "Australia", "Bélgica", "Brasil", "Burkina Faso",
  "Canadá", "China", "Colombia", "España", "Estados Unidos", "Finlandia",
  "Francia", "India", "Japón", "Luxemburgo", "Mauritania", "México",
  "Mozambique (Observador)", "Noruega", "Reino Unido", "Ruanda", "Senegal",
  "Sudáfrica", "Sudán (Observador)",
];

export async function getCommitteeDetail(committee: Committee): Promise<CommitteeDetail> {
  try {
    const response = await fetch(
      `https://itammun.itam.mx/backend/public/api/public/debates/${committee.id}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error("No fue posible cargar el comité");
    const payload = await response.json() as {
      debate?: {
        topics?: Array<{ title?: string }>;
        representations?: Array<{ id: string; name: string; flagUrl?: string }>;
      };
    };
    return {
      topics: payload.debate?.topics?.map((topic) => topic.title ?? "").filter(Boolean) ?? [],
      representations: payload.debate?.representations?.map((representation) => ({
        ...representation,
        observer: /observador/i.test(representation.name),
      })) ?? [],
    };
  } catch {
    return {
      topics: ["Tópico A", "Tópico B"],
      representations: fallbackRepresentations.slice(0, committee.representationsCount).map((name, index) => ({
        id: `fallback-${index}`,
        name,
        observer: /observador/i.test(name),
      })),
    };
  }
}
