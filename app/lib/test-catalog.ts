import type { CommitteeDetail, Representation } from "./itammun-api";

type CountrySeed = Representation & { iso2: string };

export const testCountries: CountrySeed[] = [
  { id: "AFG", iso2: "af", name: "Afganistán", flagUrl: "https://flagcdn.com/w80/af.png", observer: false },
  { id: "DEU", iso2: "de", name: "Alemania", flagUrl: "https://flagcdn.com/w80/de.png", observer: false },
  { id: "ARG", iso2: "ar", name: "Argentina", flagUrl: "https://flagcdn.com/w80/ar.png", observer: false },
  { id: "AUS", iso2: "au", name: "Australia", flagUrl: "https://flagcdn.com/w80/au.png", observer: false },
  { id: "BEL", iso2: "be", name: "Bélgica", flagUrl: "https://flagcdn.com/w80/be.png", observer: false },
  { id: "BRA", iso2: "br", name: "Brasil", flagUrl: "https://flagcdn.com/w80/br.png", observer: false },
  { id: "BFA", iso2: "bf", name: "Burkina Faso", flagUrl: "https://flagcdn.com/w80/bf.png", observer: false },
  { id: "CAN", iso2: "ca", name: "Canadá", flagUrl: "https://flagcdn.com/w80/ca.png", observer: false },
  { id: "CHL", iso2: "cl", name: "Chile", flagUrl: "https://flagcdn.com/w80/cl.png", observer: false },
  { id: "CHN", iso2: "cn", name: "China", flagUrl: "https://flagcdn.com/w80/cn.png", observer: false },
  { id: "COL", iso2: "co", name: "Colombia", flagUrl: "https://flagcdn.com/w80/co.png", observer: false },
  { id: "KOR", iso2: "kr", name: "Corea del Sur", flagUrl: "https://flagcdn.com/w80/kr.png", observer: false },
  { id: "CRI", iso2: "cr", name: "Costa Rica", flagUrl: "https://flagcdn.com/w80/cr.png", observer: false },
  { id: "EGY", iso2: "eg", name: "Egipto", flagUrl: "https://flagcdn.com/w80/eg.png", observer: false },
  { id: "ESP", iso2: "es", name: "España", flagUrl: "https://flagcdn.com/w80/es.png", observer: false },
  { id: "USA", iso2: "us", name: "Estados Unidos", flagUrl: "https://flagcdn.com/w80/us.png", observer: false },
  { id: "FIN", iso2: "fi", name: "Finlandia", flagUrl: "https://flagcdn.com/w80/fi.png", observer: false },
  { id: "FRA", iso2: "fr", name: "Francia", flagUrl: "https://flagcdn.com/w80/fr.png", observer: false },
  { id: "IND", iso2: "in", name: "India", flagUrl: "https://flagcdn.com/w80/in.png", observer: false },
  { id: "IDN", iso2: "id", name: "Indonesia", flagUrl: "https://flagcdn.com/w80/id.png", observer: false },
  { id: "JPN", iso2: "jp", name: "Japón", flagUrl: "https://flagcdn.com/w80/jp.png", observer: false },
  { id: "LUX", iso2: "lu", name: "Luxemburgo", flagUrl: "https://flagcdn.com/w80/lu.png", observer: false },
  { id: "MEX", iso2: "mx", name: "México", flagUrl: "https://flagcdn.com/w80/mx.png", observer: false },
  { id: "MOZ", iso2: "mz", name: "Mozambique", flagUrl: "https://flagcdn.com/w80/mz.png", observer: false },
  { id: "NOR", iso2: "no", name: "Noruega", flagUrl: "https://flagcdn.com/w80/no.png", observer: false },
  { id: "GBR", iso2: "gb", name: "Reino Unido", flagUrl: "https://flagcdn.com/w80/gb.png", observer: false },
  { id: "RWA", iso2: "rw", name: "Ruanda", flagUrl: "https://flagcdn.com/w80/rw.png", observer: false },
  { id: "SEN", iso2: "sn", name: "Senegal", flagUrl: "https://flagcdn.com/w80/sn.png", observer: false },
  { id: "ZAF", iso2: "za", name: "Sudáfrica", flagUrl: "https://flagcdn.com/w80/za.png", observer: false },
  { id: "SDN", iso2: "sd", name: "Sudán", flagUrl: "https://flagcdn.com/w80/sd.png", observer: false },
  { id: "UGA", iso2: "ug", name: "Uganda", flagUrl: "https://flagcdn.com/w80/ug.png", observer: false },
  { id: "VAT", iso2: "va", name: "Santa Sede (Observador)", flagUrl: "https://flagcdn.com/w80/va.png", observer: true },
  { id: "PSE", iso2: "ps", name: "Estado de Palestina (Observador)", flagUrl: "https://flagcdn.com/w80/ps.png", observer: true },
];

const topics: Record<string, string[]> = {
  "onu-mujeres": ["Reducción de la brecha de género en la asistencia humanitaria en Sudán", "IA, educación y respeto a la diversidad de género en Asia-Pacífico"],
  acnur: ["Protección de personas desplazadas por conflictos", "Soluciones duraderas para personas refugiadas"],
  unicef: ["Protección de la infancia en emergencias", "Acceso equitativo a educación y salud"],
  cij: ["Case A", "Case B"],
  onudi: ["Inclusive and sustainable industrial development", "Technology transfer and productive capacity"],
  cepa: ["Cooperación regional y desarrollo", "Mecanismos de integración económica"],
  "banco-mundial": ["Financiamiento climático", "Reducción de pobreza y desarrollo institucional"],
  "consejo-de-seguridad": ["Situación en Sudán", "Mantenimiento de la paz y seguridad internacionales"],
  interpol: ["Cooperación contra el crimen transnacional", "Ciberdelincuencia y coordinación policial"],
  otan: ["Collective security and emerging threats", "Alliance resilience and strategic cooperation"],
};

export function getTestCommitteeDetail(slug: string, count: number): CommitteeDetail {
  if (slug.startsWith("lienzo-")) return { topics: [], representations: [] };
  const members = testCountries.filter((country) => !country.observer).slice(0, Math.min(count, 31));
  const observers = count > members.length ? testCountries.filter((country) => country.observer).slice(0, count - members.length) : [];
  return { topics: topics[slug] ?? ["Tópico A", "Tópico B"], representations: [...members, ...observers] };
}
