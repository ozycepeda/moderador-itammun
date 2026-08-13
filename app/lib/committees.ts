export type Committee = {
  id: string;
  slug: string;
  abbreviation: string;
  name: string;
  language: "ES" | "EN";
  level: "Bajo" | "Intermedio" | "Alto";
  representationType: "delegacion" | "juez";
  representationsCount: number;
  secretariat: string;
  color: string;
  darkColor: string;
};

// IDs y metadatos confirmados contra la API pública vigente de ITAMMUN.
// Los colores replican el mapa visual del bundle público actual; la API aún no
// los entrega como campos de base de datos. La migración PostgreSQL incluida en
// sql/001_moderator.sql los guarda como configuración del moderador.
export const committees: Committee[] = [
  { id: "27c2f7cf-0188-4733-b8f1-2406c4313e52", slug: "onu-mujeres", abbreviation: "ONU Mujeres", name: "ONU Mujeres", language: "ES", level: "Bajo", representationType: "delegacion", representationsCount: 25, secretariat: "Asuntos Humanitarios", color: "#3C98A5", darkColor: "#1A3A3E" },
  { id: "eb2c6702-122d-4e3f-bae5-185731081340", slug: "acnur", abbreviation: "ACNUR", name: "ACNUR", language: "ES", level: "Intermedio", representationType: "delegacion", representationsCount: 25, secretariat: "Asuntos Humanitarios", color: "#82BAB7", darkColor: "#1C3635" },
  { id: "4194a8ae-e21d-4fdc-a3b1-db441b7ac397", slug: "unicef", abbreviation: "UNICEF", name: "UNICEF", language: "ES", level: "Bajo", representationType: "delegacion", representationsCount: 25, secretariat: "Asuntos Humanitarios", color: "#72B7BE", darkColor: "#1C3537" },
  { id: "8c77c124-bf8e-4079-b983-ce3a28b147fc", slug: "cij", abbreviation: "ICJ", name: "International Court of Justice", language: "EN", level: "Alto", representationType: "juez", representationsCount: 15, secretariat: "Asuntos Humanitarios", color: "#2D748E", darkColor: "#142D36" },
  { id: "2a18eb34-8372-40d5-9ce8-b8aa4134a845", slug: "onudi", abbreviation: "UNIDO", name: "United Nations Industrial Development Organization", language: "EN", level: "Bajo", representationType: "delegacion", representationsCount: 25, secretariat: "Economía y Desarrollo", color: "#7A966D", darkColor: "#1E2E1A" },
  { id: "116a16b6-36c0-4c0f-92ac-ec8c2a352cc6", slug: "cepa", abbreviation: "CEPA", name: "CEPA", language: "ES", level: "Alto", representationType: "delegacion", representationsCount: 25, secretariat: "Economía y Desarrollo", color: "#83A33E", darkColor: "#242E14" },
  { id: "019f9157-f987-4368-965a-5635cffb642f", slug: "banco-mundial", abbreviation: "Banco Mundial", name: "Banco Mundial", language: "ES", level: "Intermedio", representationType: "delegacion", representationsCount: 25, secretariat: "Economía y Desarrollo", color: "#3D8D2A", darkColor: "#162A12" },
  { id: "49d413fb-16af-46a9-be9b-bbc2cbef6c84", slug: "consejo-de-seguridad", abbreviation: "Consejo de Seguridad", name: "Consejo de Seguridad", language: "ES", level: "Alto", representationType: "delegacion", representationsCount: 24, secretariat: "Asuntos de Seguridad", color: "#837417", darkColor: "#2A2510" },
  { id: "e8161904-e0d5-4904-8c8f-0cfe1de22435", slug: "interpol", abbreviation: "INTERPOL", name: "INTERPOL", language: "ES", level: "Intermedio", representationType: "delegacion", representationsCount: 25, secretariat: "Asuntos de Seguridad", color: "#B79D3E", darkColor: "#2E2812" },
  { id: "d33f3125-44d8-4b8b-a417-b973fd017069", slug: "otan", abbreviation: "NATO", name: "North Atlantic Treaty Organization", language: "EN", level: "Alto", representationType: "delegacion", representationsCount: 25, secretariat: "Asuntos de Seguridad", color: "#E8B117", darkColor: "#332A0C" },
];

export const committeeBySlug = (slug: string) =>
  committees.find((committee) => committee.slug === slug);
